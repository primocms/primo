create table public.sites (
    created_at timestamp with time zone not null default now(),
    name text null,
    code jsonb null default '{"js": "", "css": "", "html": ""}' :: jsonb,
    owner uuid not null,
    published boolean null default false,
    distribution_id text null,
    distribution_domain_name text null,
    validation_record jsonb null,
    custom_domain text null,
    custom_domain_connected boolean null default false,
    custom_domain_validated boolean not null default false,
    design jsonb null,
    id uuid not null default gen_random_uuid (),
    oldid bigint null,
    nameservers jsonb null,
    constraint sites_pkey primary key (id),
    constraint sites_owner_fkey1 foreign key (owner) references auth.users (id) on update cascade on delete cascade
) tablespace pg_default;

create table public.page_types (
    created_at timestamp with time zone not null default now(),
    name text null,
    code jsonb not null,
    color text null,
    icon text null,
    index numeric null default '0' :: numeric,
    id uuid not null default gen_random_uuid (),
    oldid bigint null,
    site uuid null,
    constraint page_types_pkey primary key (id),
    constraint page_types_site_fkey foreign key (site) references sites (id) on update cascade on delete cascade
) tablespace pg_default;

create table public.pages (
    created_at timestamp with time zone not null default now(),
    name text null,
    slug text not null,
    index numeric null default '0' :: numeric,
    id uuid not null default gen_random_uuid (),
    oldid bigint null,
    page_type uuid null,
    parent uuid null,
    constraint pages_pkey primary key (id),
    constraint pages_page_type_fkey foreign key (page_type) references page_types (id) on update cascade on delete cascade,
    constraint pages_parent_fkey foreign key (parent) references pages (id) on update cascade on delete cascade
) tablespace pg_default;

create table public.sections (
    created_at timestamp with time zone not null default now(),
    index integer null,
    id uuid not null default gen_random_uuid (),
    oldid bigint null,
    symbol uuid null,
    page_type uuid null,
    page uuid null,
    master uuid null,
    palette uuid null,
    constraint sections_pkey primary key (id),
    constraint sections_master_fkey foreign key (master) references sections (id) on update cascade on delete cascade,
    constraint sections_page_fkey foreign key (page) references pages (id) on update cascade on delete cascade,
    constraint sections_page_type_fkey foreign key (page_type) references page_types (id) on update cascade on delete cascade,
    constraint sections_palette_fkey foreign key (palette) references sections (id) on update cascade on delete cascade,
    constraint sections_symbol_fkey foreign key (symbol) references symbols (id) on update cascade on delete cascade
) tablespace pg_default;

create table public.symbols (
    created_at timestamp with time zone not null default now(),
    name text null default '' :: text,
    code jsonb null default '{"js": "", "css": "", "html": ""}' :: jsonb,
    index bigint not null default '0' :: bigint,
    id uuid not null default gen_random_uuid (),
    oldid bigint null,
    site uuid null,
    old_page_types bigint [] null,
    page_types uuid [] not null default '{}' :: uuid [],
    constraint symbols_pkey primary key (id),
    constraint symbols_site_fkey foreign key (site) references sites (id) on update cascade on delete cascade
) tablespace pg_default;

create table public.fields (
    key text not null,
    label text not null,
    type text not null,
    options jsonb not null default '{}' :: jsonb,
    created_at timestamp with time zone not null default now(),
    index smallint null default '0' :: smallint,
    id uuid not null default gen_random_uuid (),
    oldid bigint null,
    symbol uuid null,
    page_type uuid null,
    site uuid null,
    parent uuid null,
    source uuid null,
    constraint fields_pkey primary key (id),
    constraint fields_page_type_fkey foreign key (page_type) references page_types (id) on update cascade on delete cascade,
    constraint fields_parent_fkey foreign key (parent) references fields (id) on update cascade on delete cascade,
    constraint fields_site_fkey foreign key (site) references sites (id) on update cascade on delete cascade,
    constraint fields_source_fkey foreign key (source) references fields (id) on update cascade on delete
    set
        null,
        constraint fields_symbol_fkey foreign key (symbol) references symbols (id) on update cascade on delete cascade
) tablespace pg_default;

create table public.entries (
    value jsonb null,
    created_at timestamp with time zone not null default now(),
    locale text null default 'en' :: text,
    index numeric null,
    metadata jsonb null,
    id uuid not null default gen_random_uuid (),
    oldid bigint null,
    field uuid null,
    parent uuid null,
    page uuid null,
    page_type uuid null,
    section uuid null,
    symbol uuid null,
    site uuid null,
    constraint content_pkey primary key (id),
    constraint entries_field_fkey foreign key (field) references fields (id) on update cascade on delete cascade,
    constraint entries_page_fkey foreign key (page) references pages (id) on update cascade on delete cascade,
    constraint entries_page_type_fkey foreign key (page_type) references page_types (id) on update cascade on delete cascade,
    constraint entries_parent_fkey foreign key (parent) references entries (id) on update cascade on delete cascade,
    constraint entries_section_fkey foreign key (section) references sections (id) on update cascade on delete cascade,
    constraint entries_site_fkey foreign key (site) references sites (id) on update cascade on delete cascade,
    constraint entries_symbol_fkey foreign key (symbol) references symbols (id) on update cascade on delete cascade
) tablespace pg_default;

create table public.profiles (
    id uuid not null,
    customer_id text null,
    user_email text null,
    constraint profiles_pkey primary key (id),
    constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade
) tablespace pg_default;

create table public.collaborators (
    role text null,
    created_at timestamp with time zone not null default now(),
    id bigint generated by default as identity not null,
    "user" uuid not null,
    profile uuid null,
    oldid bigint null,
    site uuid null,
    constraint collaborators_pkey primary key (id),
    constraint collaborators_profile_fkey foreign key (profile) references profiles (id) on update cascade on delete cascade,
    constraint collaborators_site_fkey foreign key (site) references sites (id) on update cascade on delete cascade,
    constraint collaborators_user_fkey foreign key ("user") references auth.users (id) on update cascade on delete cascade
) tablespace pg_default;