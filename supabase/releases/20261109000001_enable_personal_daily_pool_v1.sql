-- Personal daily V1 editorial pool. Apply separately, after 20261106000001.
-- Authoritative manifest SHA-256: 8aee0046811a21f51b65641d638d17440f0c81b1ae354adda47128bcb7d2bbc7
-- 2026-11-03 through 2027-01-01: 60 distinct movie UUIDs.
-- No calendar, catalog metadata, genre, or assignment writes. Existing eligible
-- films outside this manifest are left untouched. Keep the mobile flag OFF until
-- this transaction and post-deployment verification have succeeded.
begin;

do $pool$
declare
  manifest_ids constant uuid[] := array[
    '685617d6-9ada-47a0-8871-03a6d6e6447e',
    'e842cad0-d5a2-4f7d-ba9f-44cc1d47bd75',
    '9928da8b-a7ba-442b-9ec4-457d8049a83b',
    '4be7a28d-5052-4c08-b221-cf89e326c2be',
    '3327bc77-f405-4d98-9113-d16981d88773',
    '9a51536d-6e94-4831-b4cb-b67ecbeebdde',
    'f32bfcea-ae20-4535-ac1c-69c46b6026fe',
    'd3a580ad-968e-49fe-a927-ba38ad97bde9',
    'deea1664-4894-4f3b-9345-1a1ac1ba4a47',
    '25216e3d-cdf0-4234-9417-065b7a85bf57',
    '9c4aa2e2-1f26-45f5-8562-d7dcce90f85a',
    'e51038f0-f230-4bc9-996a-f5ada62617d6',
    '1b995f6b-ed5d-4a9b-9008-616e02de2ee4',
    '0eb50f25-4526-4b2c-9e63-7ea6df992264',
    'c700ba59-5454-4552-a244-8f5da78bcae2',
    'ed8f2408-f5a9-432b-952f-91c065bfcdc4',
    '17b1112b-9db6-48aa-8522-31237a11f86c',
    'cfd340e4-13c8-43c5-921f-c28a9359205b',
    'e3e5eba5-218d-46d5-8a6e-af46ee6c9a81',
    'd4b29906-5fed-4310-82f4-a9096007f19f',
    '9b8a5a53-5c36-40e3-b6a4-74885f896830',
    '8100d429-87a1-4c11-9f23-1f83ea81d767',
    '3ff76515-2f43-48b0-b22c-8b97def6cf48',
    '4b819843-a2c2-4cc2-81ca-1fb8e6c69f43',
    'a64d1bcd-dc99-41a1-9a45-8e916b9a8c5a',
    '9c2d88db-4389-4770-b670-3a4783bbf0c1',
    '5ea9dfcd-5fbb-4d88-ab3c-0afe3ada6a0a',
    '375cb79f-223a-4883-92f1-edd8ddc05e33',
    '4cfda943-6be1-424b-bbe5-ab29fddc88bc',
    '39e35f2c-c1ca-4957-b768-93823d56b392',
    '3d4e4425-7a2d-4467-9b54-6969c84aefb4',
    '1be06267-77ca-4707-8e59-1b6541b61e80',
    'c451fad3-de65-4f24-8d60-00e7f4a69a84',
    '0864b2d1-3606-45c8-8261-0a78148f603a',
    '30816e18-a7de-46ee-a075-7cd1fc952bd2',
    'cb9413ca-79e5-4c78-a427-7329dfb77c50',
    'b6e3fd60-b4ec-4491-8160-439beab482ae',
    '3ec81ee4-789c-42f8-8723-7bf81f183adb',
    '17c90fef-109b-492f-bf87-0fad9a4e52a7',
    'c29c2f75-cc85-4529-a498-0ee30733c3c9',
    'be7b4931-b9a9-4bf3-8ba4-7deac3b011fc',
    '67164a6b-1632-4603-a282-9e31096e3846',
    '0cf2c20b-a838-4552-9183-adf280e85c7d',
    'f6340fbc-588a-4fb7-a391-6f2e3e986e6f',
    '7349c0e5-a8c0-42a2-bca7-97c0f51527cd',
    '24abf3c6-94d1-41db-a3cc-d23a3c205ee5',
    '6b3c9241-56f0-47fa-957b-d225fa1661c3',
    '196cec68-cdc3-426e-b1f5-a3b3ce4335af',
    '573b30bc-1932-48cf-b02a-c2a3c5f2bd32',
    'd88365d5-15e4-4e1d-ae4e-3dcc6320f0bc',
    '476c6647-f510-4e99-9090-64f7f681f148',
    'e1454ce7-dc12-41c1-97ac-754feb6517cf',
    '2267693a-b885-465e-b36c-79426aeebb59',
    '41f225a0-de06-4e23-9ba3-0d13c10ada5d',
    'b3279ca7-def8-4bd2-86f0-72c7901ca874',
    '8444fea3-fad6-4d40-aa34-231401c12223',
    '60c2e5c4-85c8-4677-90ab-a26aae56ee7b',
    '5250c190-5451-4785-9bec-d7a93ff3815d',
    '1a3d5c30-d59e-41d7-8502-e5bba0af5def',
    '95cfdd99-bdf7-430d-b0ee-03be546e6670'
  ]::uuid[];
  missing_ids uuid[];
  locked_count integer;
  enabled_count integer;
begin
  if cardinality(manifest_ids) <> 60
    or (select count(distinct id) from unnest(manifest_ids) as requested(id)) <> 60 then
    raise exception 'Personal daily pool must contain exactly 60 distinct UUIDs';
  end if;

  -- Lock in a stable order so validation cannot race a concurrent deletion.
  -- Locks are taken before validation; no row is updated until every UUID exists.
  perform m.id from public.movies m
    where m.id = any(manifest_ids) order by m.id for update;
  get diagnostics locked_count = row_count;
  select array_agg(requested.id order by requested.id) into missing_ids
    from unnest(manifest_ids) as requested(id)
    where not exists (select 1 from public.movies m where m.id = requested.id);
  if locked_count <> 60 or missing_ids is not null then
    raise exception 'Personal daily pool requires 60 locked catalog UUIDs; locked: %, missing: %', locked_count, missing_ids
      using errcode = '23503';
  end if;

  -- The predicate prevents even updated_at triggers firing on a second run.
  update public.movies set daily_recommendation_eligible = true
    where id = any(manifest_ids) and daily_recommendation_eligible is distinct from true;
  get diagnostics enabled_count = row_count;
  if (select count(*) from public.movies where id = any(manifest_ids) and daily_recommendation_eligible) <> 60 then
    raise exception 'Personal daily pool postcondition failed; rolling back all changes';
  end if;
  raise notice 'Personal daily pool verified: 60 UUIDs; newly enabled: %', enabled_count;
end;
$pool$;

commit;
