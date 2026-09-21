-- 21-fix-event-store-participant-birth-date.sql
-- Surgical fix: INSERT into event_signups.participant_birth_date
-- was casting v_birth::text, but the column type is DATE.
-- RPC signature and all other logic stay identical to migration 17.
-- Do not auto-apply in this step.

begin;

create or replace function public.create_event_signup_with_store(
  _event_id uuid,
  _distance text,
  _category text,
  _kit_names jsonb default '[]'::jsonb,      -- ["Kit Completo"]
  _shirt_size text default null,
  _coupon_code text default null,
  _team_name text default '',
  _notes text default '',
  _participant_full_name text default '',
  _participant_cpf text default null,
  _participant_birth_date text default null,
  _participant_gender text default null,
  _participant_phone text default null,
  _accepted_event_terms_at timestamptz default now(),
  _store_items jsonb default '[]'::jsonb     -- [{ "variant_id": "...", "quantity": 1 }]
  -- MVP: SEM _existing_signup_id (superfÃ­cie insegura). Retomada = nova chamada
  -- ou fluxo separado futuro com regras explÃ­citas.
)
returns table (
  signup_id uuid,
  order_id uuid,
  registration_base_amount numeric,
  kit_adjustment_amount numeric,
  discount_amount numeric,
  registration_amount numeric,
  products_amount numeric,
  total_amount numeric,
  commission_percentage_snapshot numeric,
  commission_base_amount numeric,
  commission_amount numeric,
  organizer_net_amount numeric,
  pricing_snapshot jsonb
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
  v_dist jsonb;
  v_today date := (timezone('America/Sao_Paulo', now()))::date;
  v_age integer;
  v_senior boolean := false;
  v_senior_fixed boolean := false;
  v_base numeric(12,2) := 0;
  v_kit_adj numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_reg_amount numeric(12,2) := 0;
  v_products numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_coupon_code text := '';
  v_coupon_json jsonb;
  v_coupon_type text;
  v_coupon_value numeric;
  v_signup_id uuid;
  v_order_id uuid := null;
  v_snapshot jsonb;
  v_kit_option text := '';
  r jsonb;
  v_variant_id uuid;
  v_qty integer;
  v_product public.event_store_products%rowtype;
  v_variant public.event_store_product_variants%rowtype;
  v_unit numeric(12,2);
  v_line numeric(12,2);
  v_item_lines jsonb := '[]'::jsonb;
  v_birth date;
  v_lote integer := 1;
  v_last_lote integer := 1;
  v_variant_ids uuid[];
  v_sorted_items jsonb := '[]'::jsonb;
  v_org_pct numeric := 0;
  v_org_is_platform boolean := false;
  v_is_platform boolean := true;
  v_commission_pct numeric(8,4) := 0;
  v_commission_base numeric(12,2) := 0;
  v_commission_amount numeric(12,2) := 0;
  v_organizer_net numeric(12,2) := 0;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  begin
    v_birth := nullif(trim(coalesce(_participant_birth_date, '')), '')::date;
  exception when others then
    raise exception 'BIRTH_DATE_INVALID' using errcode = 'P0001';
  end;

  if _event_id is null then
    raise exception 'EVENT_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_event
  from public.events e
  where e.id = _event_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if coalesce(v_event.active, false) is not true then
    raise exception 'EVENT_INACTIVE' using errcode = 'P0001';
  end if;

  -- ComissÃ£o congelada no checkout â€” identificaÃ§Ã£o ESTRUTURAL:
  --   organizer_id null OU is_platform_owner â†’ pct 0
  --   parceiro â†’ organizers.commission_percentage
  -- NUNCA derivar comissÃ£o pelo nome.
  v_is_platform := true;
  v_commission_pct := 0;
  if v_event.organizer_id is not null then
    select coalesce(o.commission_percentage, 0),
           coalesce(o.is_platform_owner, false)
      into v_org_pct, v_org_is_platform
    from public.organizers o
    where o.id = v_event.organizer_id;

    if found and v_org_is_platform is not true then
      v_is_platform := false;
      v_commission_pct := greatest(coalesce(v_org_pct, 0), 0);
    end if;
  end if;

  if trim(coalesce(_participant_full_name, '')) = '' then
    raise exception 'PARTICIPANT_NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if trim(coalesce(_distance, '')) = '' then
    raise exception 'DISTANCE_REQUIRED' using errcode = 'P0001';
  end if;
  if trim(coalesce(_category, '')) = '' then
    raise exception 'CATEGORY_REQUIRED' using errcode = 'P0001';
  end if;
  if _accepted_event_terms_at is null then
    raise exception 'TERMS_REQUIRED' using errcode = 'P0001';
  end if;

  v_dist := public.event_store_find_distance(v_event.distances, _distance);
  if v_dist is null then
    raise exception 'DISTANCE_INVALID' using errcode = 'P0001';
  end if;

  v_age := public.event_store_age_at_event(
    v_birth,
    case when v_event.date is null then null else (v_event.date::text)::date end
  );
  v_senior := (
    not public.event_store_is_kids_distance(_distance)
    and v_age is not null
    and v_age >= 60
  );
  begin
    v_senior_fixed := v_senior
      and coalesce(nullif(v_dist->>'price_60_plus', '')::numeric, 0) > 0;
  exception when others then
    v_senior_fixed := false;
  end;

  v_base := public.event_store_effective_distance_price(v_dist, v_senior, v_today);
  v_lote := public.event_store_active_lote(v_dist, v_today);
  v_last_lote := public.event_store_last_lote(v_dist);

  -- Kits (valida last_lot / all_lots; extra_price ASSINADO)
  v_kit_adj := public.event_store_kit_adjustment(
    coalesce(v_event.kit_options, '[]'::jsonb),
    coalesce(_kit_names, '[]'::jsonb),
    v_dist,
    v_today
  );
  if jsonb_typeof(coalesce(_kit_names, '[]'::jsonb)) = 'array'
     and jsonb_array_length(_kit_names) > 0 then
    v_kit_option := _kit_names::text;
  end if;

  -- Cupom sÃ³ sobre max(0, base+kit)
  select d.discount, d.code_out, d.coupon_json
    into v_discount, v_coupon_code, v_coupon_json
  from public.event_store_coupon_discount(
    v_event.coupons,
    _coupon_code,
    greatest(v_base + v_kit_adj, 0)
  ) d;

  v_coupon_code := coalesce(v_coupon_code, '');
  v_coupon_type := lower(trim(coalesce(v_coupon_json->>'type', '')));
  begin
    v_coupon_value := nullif(v_coupon_json->>'value', '')::numeric;
  exception when others then
    v_coupon_value := null;
  end;

  v_reg_amount := greatest(v_base + v_kit_adj - coalesce(v_discount, 0), 0);

  -- Ordena itens por variant_id (locks determinÃ­sticos)
  if _store_items is not null
     and jsonb_typeof(_store_items) = 'array'
     and jsonb_array_length(_store_items) > 0 then
    select coalesce(jsonb_agg(elem order by (elem->>'variant_id')), '[]'::jsonb)
      into v_sorted_items
    from jsonb_array_elements(_store_items) elem;

    for r in select * from jsonb_array_elements(v_sorted_items)
    loop
      begin
        v_variant_id := nullif(trim(coalesce(r->>'variant_id', '')), '')::uuid;
      exception when others then
        raise exception 'STORE_INVALID_ITEM' using errcode = 'P0001';
      end;
      v_qty := coalesce((r->>'quantity')::integer, 0);
      if v_variant_id is null or v_qty < 1 then
        raise exception 'STORE_INVALID_ITEM' using errcode = 'P0001';
      end if;
      if r ? 'unit_price' or r ? 'line_total' or r ? 'price' or r ? 'total' then
        raise exception 'STORE_CLIENT_PRICE_FORBIDDEN' using errcode = 'P0001';
      end if;
    end loop;
  else
    v_sorted_items := '[]'::jsonb;
  end if;

  insert into public.event_signups (
    user_id, event_id, category, status, notes, kit_option, shirt_size,
    coupon_code, team_name, accepted_event_terms_at,
    participant_full_name, participant_cpf, participant_birth_date,
    participant_gender, participant_phone,
    registration_base_amount, kit_adjustment_amount, discount_amount,
    registration_amount, products_amount, total_amount, pricing_snapshot
  ) values (
    v_uid, _event_id, trim(_category), 'pendente', coalesce(_notes, ''),
    v_kit_option, nullif(trim(coalesce(_shirt_size, '')), ''),
    v_coupon_code, coalesce(_team_name, ''), _accepted_event_terms_at,
    trim(_participant_full_name),
    nullif(trim(coalesce(_participant_cpf, '')), ''),
    v_birth,
    nullif(trim(coalesce(_participant_gender, '')), ''),
    nullif(trim(coalesce(_participant_phone, '')), ''),
    v_base, v_kit_adj, v_discount, v_reg_amount, null, null, null
  )
  returning id into v_signup_id;

  if jsonb_array_length(v_sorted_items) > 0 then
    insert into public.event_store_orders (
      event_id, organizer_id, user_id, signup_id, status,
      products_amount, total_amount, fulfillment_type
    ) values (
      v_event.id,
      v_event.organizer_id,
      v_uid,
      v_signup_id,
      'pendente',
      0, 0,
      'kit_pickup'
    )
    returning id into v_order_id;

    -- PrÃ©-lock de todas as variantes em ordem estÃ¡vel
    select array_agg((elem->>'variant_id')::uuid order by (elem->>'variant_id'))
      into v_variant_ids
    from jsonb_array_elements(v_sorted_items) elem;

    perform 1
    from public.event_store_product_variants v
    where v.id = any (v_variant_ids)
    order by v.id
    for update;

    for r in select * from jsonb_array_elements(v_sorted_items)
    loop
      v_variant_id := (r->>'variant_id')::uuid;
      v_qty := (r->>'quantity')::integer;

      select * into v_variant
      from public.event_store_product_variants
      where id = v_variant_id;

      if not found or v_variant.active is not true then
        raise exception 'STORE_VARIANT_INACTIVE' using errcode = 'P0001';
      end if;

      select * into v_product
      from public.event_store_products
      where id = v_variant.product_id;

      if not found
         or v_product.event_id <> v_event.id
         or v_product.active is not true then
        raise exception 'STORE_PRODUCT_WRONG_EVENT' using errcode = 'P0001';
      end if;

      -- Janela de venda: autoridade no servidor (frontend NÃƒO decide)
      if v_product.sale_starts_at is not null
         and now() < v_product.sale_starts_at then
        raise exception 'STORE_PRODUCT_NOT_STARTED' using errcode = 'P0001';
      end if;
      if v_product.sale_ends_at is not null
         and now() > v_product.sale_ends_at then
        raise exception 'STORE_PRODUCT_SALES_ENDED' using errcode = 'P0001';
      end if;

      v_unit := coalesce(v_variant.price_override, v_product.price);
      v_line := round(v_unit * v_qty, 2);
      v_products := v_products + v_line;

      insert into public.event_store_order_items (
        order_id, product_id, variant_id,
        product_name_snapshot, variant_name_snapshot, image_url_snapshot,
        unit_price, quantity, line_total
      ) values (
        v_order_id, v_product.id, v_variant.id,
        v_product.name, v_variant.name, v_product.image_url,
        v_unit, v_qty, v_line
      );

      -- pricing_snapshot.store_items: IDs + valores (sem image â€” evita duplicar
      -- image_url_snapshot que jÃ¡ vive no order item histÃ³rico)
      v_item_lines := v_item_lines || jsonb_build_array(jsonb_build_object(
        'variant_id', v_variant.id,
        'product_id', v_product.id,
        'product_name', v_product.name,
        'variant_name', v_variant.name,
        'unit_price', v_unit,
        'quantity', v_qty,
        'line_total', v_line
      ));
    end loop;

    update public.event_store_orders
    set products_amount = v_products,
        total_amount = v_products,
        updated_at = now()
    where id = v_order_id;
  end if;

  v_total := v_reg_amount + v_products;

  -- ComissÃ£o sobre TODO o valor movimentado (inscriÃ§Ã£o + produtos).
  -- NÃƒO gravar comissÃ£o separada em event_store_orders.
  v_commission_base := v_total;
  v_commission_amount := round(v_total * v_commission_pct / 100.0, 2);
  v_organizer_net := greatest(v_total - v_commission_amount, 0);

  v_snapshot := jsonb_build_object(
    'version', 2,
    'distance', trim(_distance),
    'category', trim(_category),
    'lote', v_lote,
    'last_lote', v_last_lote,
    'senior', v_senior,
    'senior_fixed', v_senior_fixed,
    'age_at_event', v_age,
    'registration_base_amount', v_base,
    'kit_adjustment_amount', v_kit_adj,
    'discount_amount', v_discount,
    'registration_amount', v_reg_amount,
    'products_amount', v_products,
    'total_amount', v_total,
    'commission_percentage_snapshot', v_commission_pct,
    'commission_base_amount', v_commission_base,
    'commission_amount', v_commission_amount,
    'organizer_net_amount', v_organizer_net,
    'is_platform_owned', v_is_platform,
    'coupon_code', nullif(v_coupon_code, ''),
    'coupon_type', nullif(v_coupon_type, ''),
    'coupon_value', v_coupon_value,
    'kit_names', coalesce(_kit_names, '[]'::jsonb),
    'store_items', v_item_lines,
    'currency', 'BRL',
    'priced_at', now(),
    'priced_on_date', v_today
  );

  update public.event_signups
  set products_amount = v_products,
      total_amount = v_total,
      commission_percentage_snapshot = v_commission_pct,
      commission_base_amount = v_commission_base,
      commission_amount = v_commission_amount,
      organizer_net_amount = v_organizer_net,
      pricing_snapshot = v_snapshot,
      updated_at = now()
  where id = v_signup_id;

  return query select
    v_signup_id,
    v_order_id,
    v_base,
    v_kit_adj,
    v_discount,
    v_reg_amount,
    v_products,
    v_total,
    v_commission_pct,
    v_commission_base,
    v_commission_amount,
    v_organizer_net,
    v_snapshot;
end;
$fn$;
commit;