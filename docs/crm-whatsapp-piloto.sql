-- Executar pelo editor SQL do Lovable no Supabase de teste.
-- Escopo: workspace, leitura de contatos e captação/relatório de leads do WhatsApp.
begin;

create schema crm_pilot;
revoke all on schema crm_pilot from public, anon, authenticated, service_role;

create table crm_pilot.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);
create table crm_pilot.memberships (
  tenant_id uuid not null references crm_pilot.organizations,
  user_id uuid not null references auth.users(id),
  active boolean not null default true,
  primary key (tenant_id, user_id)
);
create table crm_pilot.channels (
  instance text primary key check (instance ~ '^[[:alnum:]_-]{1,100}$'),
  tenant_id uuid not null references crm_pilot.organizations,
  active boolean not null default true,
  unique (tenant_id, instance)
);
create table crm_pilot.capture_credentials (
  token_hash bytea primary key check (length(token_hash) = 32)
);
create table crm_pilot.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references crm_pilot.organizations,
  name text not null,
  phone text,
  lid text,
  status text not null default 'active' check (status in ('active','archived','merged','anonymized')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,id),
  unique (tenant_id,phone),
  unique (tenant_id,lid)
);
create table crm_pilot.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  contact_id uuid not null,
  instance text not null,
  stage text not null default 'Novo',
  entered_at timestamptz not null,
  last_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  unique (tenant_id,id),
  unique (tenant_id,contact_id),
  foreign key (tenant_id,contact_id) references crm_pilot.contacts(tenant_id,id),
  foreign key (tenant_id,instance) references crm_pilot.channels(tenant_id,instance)
);
create index crm_pilot_lead_period on crm_pilot.leads(tenant_id,entered_at);
create table crm_pilot.receipts (
  tenant_id uuid not null,
  instance text not null,
  message_id text not null,
  contact_id uuid,
  lead_id uuid,
  ingested_at timestamptz not null default now(),
  primary key (tenant_id,instance,message_id),
  foreign key (tenant_id,instance) references crm_pilot.channels(tenant_id,instance),
  foreign key (tenant_id,contact_id) references crm_pilot.contacts(tenant_id,id),
  foreign key (tenant_id,lead_id) references crm_pilot.leads(tenant_id,id)
);
create table crm_pilot.identity_conflicts (
  tenant_id uuid not null,
  instance text not null,
  message_id text not null,
  phone_contact_id uuid not null,
  lid_contact_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id,instance,message_id),
  foreign key (tenant_id,instance,message_id) references crm_pilot.receipts,
  foreign key (tenant_id,phone_contact_id) references crm_pilot.contacts(tenant_id,id),
  foreign key (tenant_id,lid_contact_id) references crm_pilot.contacts(tenant_id,id)
);
alter table crm_pilot.organizations enable row level security;
alter table crm_pilot.memberships enable row level security;
alter table crm_pilot.channels enable row level security;
alter table crm_pilot.capture_credentials enable row level security;
alter table crm_pilot.contacts enable row level security;
alter table crm_pilot.leads enable row level security;
alter table crm_pilot.receipts enable row level security;
alter table crm_pilot.identity_conflicts enable row level security;
revoke all on all tables in schema crm_pilot from public, anon, authenticated, service_role;

do $$
declare pilot_user uuid;
begin
  select u.id into strict pilot_user
  from auth.users u join public.profiles p on p.id = u.id
  where u.email_confirmed_at is not null and p.display_name = 'Conta de Teste'
    and exists (select 1 from public.user_roles r where r.user_id = u.id and r.role in ('admin','superadmin','integration_admin'));
  insert into crm_pilot.organizations(name) values ('Grupo Ômega (Matriz)'), ('Ômega Asa Sul (Franquia)');
  insert into crm_pilot.memberships(tenant_id,user_id) select id,pilot_user from crm_pilot.organizations;
  insert into crm_pilot.channels(instance,tenant_id)
  select case when name = 'Grupo Ômega (Matriz)' then 'teste-local--crm-1' else 'franquia-asasul' end,id
  from crm_pilot.organizations;
end $$;

create function public.crm_capture_whatsapp_lead_v1(p_instance text, p_event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  tenant uuid;
  event_id text := p_event->>'message_id';
  phone_value text := nullif(p_event->>'phone','');
  lid_value text := nullif(p_event->>'lid','');
  name_value text := nullif(btrim(p_event->>'name'),'');
  received timestamptz := now();
  occurred timestamptz;
  phone_contact uuid;
  lid_contact uuid;
  contact_key uuid;
  lead_key uuid;
  contact_status text;
begin
  if jsonb_typeof(p_event) is distinct from 'object' then raise exception 'CRM_VALIDATION'; end if;
  if exists (select 1 from jsonb_object_keys(p_event) as key where key not in ('message_id','phone','lid','name','sent_at'))
    or event_id is null or event_id !~ '^[[:alnum:]_:+.=-]{1,200}$'
    or (phone_value is null and lid_value is null)
    or (phone_value is not null and phone_value !~ '^\+[1-9][0-9]{7,14}$')
    or (lid_value is not null and lid_value !~ '^[0-9]{1,24}@lid$')
    or length(name_value) > 160 then raise exception 'CRM_VALIDATION'; end if;
  select c.tenant_id into tenant from crm_pilot.channels c where c.instance = p_instance and c.active;
  if tenant is null then raise exception 'CRM_FORBIDDEN'; end if;
  occurred := coalesce((p_event->>'sent_at')::timestamptz, received);
  if not isfinite(occurred) or occurred > received + interval '5 minutes' or occurred < timestamptz '2000-01-01 UTC' then
    occurred := received;
  end if;
  -- Serializa as decisões de identidade dentro de cada organização neste piloto.
  perform pg_advisory_xact_lock(hashtextextended(tenant::text, 0));
  select r.contact_id, r.lead_id into contact_key,lead_key from crm_pilot.receipts r
    where r.tenant_id = tenant and r.instance = p_instance and r.message_id = event_id;
  if found then return jsonb_build_object('contact_id',contact_key,'lead_id',lead_key); end if;
  insert into crm_pilot.receipts(tenant_id,instance,message_id) values (tenant,p_instance,event_id);
  select c.id into phone_contact from crm_pilot.contacts c where c.tenant_id = tenant and c.phone = phone_value;
  select c.id into lid_contact from crm_pilot.contacts c where c.tenant_id = tenant and c.lid = lid_value;
  contact_key := coalesce(phone_contact,lid_contact);
  if phone_contact is not null and lid_contact is not null and phone_contact <> lid_contact then
    insert into crm_pilot.identity_conflicts values (tenant,p_instance,event_id,phone_contact,lid_contact,received);
  else
    if contact_key is null then
      insert into crm_pilot.contacts(tenant_id,name,phone,lid)
      values (tenant,coalesce(name_value,phone_value,'Contato WhatsApp'),phone_value,lid_value)
      returning id into contact_key;
    end if;
    select c.status into contact_status from crm_pilot.contacts c where c.tenant_id = tenant and c.id = contact_key;
    if contact_status = 'active' then
      update crm_pilot.contacts c set phone = coalesce(c.phone,phone_value), lid = coalesce(c.lid,lid_value), updated_at = received
        where c.tenant_id = tenant and c.id = contact_key
          and (c.phone is null and phone_value is not null or c.lid is null and lid_value is not null);
      insert into crm_pilot.leads(tenant_id,contact_id,instance,entered_at,last_at)
        values (tenant,contact_key,p_instance,occurred,occurred)
        on conflict (tenant_id,contact_id) do update set
          entered_at = least(crm_pilot.leads.entered_at,excluded.entered_at),
          last_at = greatest(crm_pilot.leads.last_at,excluded.last_at)
        returning id into lead_key;
    end if;
  end if;
  update crm_pilot.receipts r set contact_id = contact_key, lead_id = lead_key
    where r.tenant_id = tenant and r.instance = p_instance and r.message_id = event_id;
  return jsonb_build_object('contact_id',contact_key,'lead_id',lead_key);
end $$;
revoke all on function public.crm_capture_whatsapp_lead_v1(text,jsonb) from public, anon, authenticated;
grant execute on function public.crm_capture_whatsapp_lead_v1(text,jsonb) to service_role;

-- Local writer with a dedicated credential. No general-purpose service-role key is needed.
create function public.crm_capture_whatsapp_pilot_v1(p_instance text, p_event jsonb, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' or not exists (
    select 1 from crm_pilot.capture_credentials c where c.token_hash = sha256(convert_to(p_token,'UTF8'))
  ) then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  return public.crm_capture_whatsapp_lead_v1(p_instance,p_event);
end $$;
revoke all on function public.crm_capture_whatsapp_pilot_v1(text,jsonb,text) from public, anon, authenticated;
grant execute on function public.crm_capture_whatsapp_pilot_v1(text,jsonb,text) to anon;

create function public.crm_api_v1(p_operation text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  tenant uuid;
  first_day date;
  last_day date;
  span_days int;
  previous_first date;
  search_term text;
  contact_status text;
  page_no int;
  page_size int;
  result jsonb;
begin
  if actor is null or not exists (select 1 from auth.users u where u.id = actor and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until < now())) then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'CRM_VALIDATION'; end if;
  if p_operation = 'workspace' then
    return jsonb_build_object('version',1,'memberships',coalesce((
      select jsonb_agg(jsonb_build_object(
        'tenant_id',o.id,'name',o.name,'user_id',actor,'active',true,'role','analyst','scope','organization',
        'team_ids','[]'::jsonb,'permissions',jsonb_build_array('contacts.read'),'timezone','America/Sao_Paulo','currency','BRL'
      ) order by o.name) from crm_pilot.memberships m join crm_pilot.organizations o on o.id=m.tenant_id where m.user_id=actor and m.active
    ),'[]'::jsonb));
  end if;
  tenant := (p_payload->>'tenant_id')::uuid;
  if tenant is null or not exists (select 1 from crm_pilot.memberships m where m.tenant_id=tenant and m.user_id=actor and m.active) then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  if p_operation = 'leads.whatsapp.daily' then
    if exists (select 1 from jsonb_object_keys(p_payload) as key where key not in ('tenant_id','start_date','end_date'))
      or coalesce(p_payload->>'start_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or coalesce(p_payload->>'end_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'CRM_VALIDATION'; end if;
    first_day := (p_payload->>'start_date')::date;
    last_day := (p_payload->>'end_date')::date;
    span_days := last_day-first_day+1;
    if span_days not between 1 and 92 or first_day < date '2000-01-01'
      or last_day > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'CRM_VALIDATION'; end if;
    previous_first := first_day-span_days;
    with counts as (
      select (l.entered_at at time zone 'America/Sao_Paulo')::date as day,count(*) as leads
      from crm_pilot.leads l join crm_pilot.contacts c on c.tenant_id=l.tenant_id and c.id=l.contact_id
      where l.tenant_id=tenant and c.status not in ('merged','anonymized')
        and l.entered_at >= (previous_first::timestamp at time zone 'America/Sao_Paulo')
        and l.entered_at < ((last_day+1)::timestamp at time zone 'America/Sao_Paulo')
      group by 1
    )
    select jsonb_build_object('days',jsonb_agg(jsonb_build_object('date',previous_first+n,'leads',coalesce(counts.leads,0)) order by n))
      into result from generate_series(0,2*span_days-1) n left join counts on counts.day=previous_first+n;
    return result;
  end if;
  if p_operation not in ('contacts.list','leads.whatsapp.list') then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  if exists (select 1 from jsonb_object_keys(p_payload) as key where key not in ('tenant_id','query','status','page','page_size'))
    then raise exception 'CRM_VALIDATION'; end if;
  search_term := btrim(coalesce(p_payload->>'query',''));
  contact_status := coalesce(p_payload->>'status','active');
  page_no := coalesce((p_payload->>'page')::int,1);
  page_size := coalesce((p_payload->>'page_size')::int,25);
  if length(search_term)>160 or contact_status not in ('active','archived') or page_no not between 1 and 100000 or page_size not between 1 and 100
    then raise exception 'CRM_VALIDATION'; end if;
  with matched as (
    select c.*,l.entered_at
    from crm_pilot.contacts c left join crm_pilot.leads l on l.tenant_id=c.tenant_id and l.contact_id=c.id
    where c.tenant_id=tenant and c.status=contact_status and (p_operation='contacts.list' or l.id is not null)
      and (search_term='' or strpos(lower(c.name),lower(search_term))>0 or strpos(coalesce(c.phone,''),search_term)>0)
  ), windowed as (
    select * from matched order by entered_at desc nulls last,id limit page_size offset (page_no-1)*page_size
  )
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',w.id,'tenant_id',w.tenant_id,'owner_id',null,'team_id',null,'name',w.name,
      'phone',coalesce(w.phone,''),'phone_normalized',w.phone,'email','','email_normalized',null,
      'source','WhatsApp','tags','[]'::jsonb,'custom_fields','{}'::jsonb,'status',w.status,
      'marketing_opt_out',false,'version',1,'created_at',w.created_at,'updated_at',w.updated_at
    ) order by w.entered_at desc nulls last,w.id) from windowed w),'[]'::jsonb),
    'total',(select count(*) from matched),'page',page_no,'page_size',page_size,'fields','[]'::jsonb
  ) into result;
  return result;
end $$;
revoke all on function public.crm_api_v1(text,jsonb) from public, anon, authenticated;
grant execute on function public.crm_api_v1(text,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
