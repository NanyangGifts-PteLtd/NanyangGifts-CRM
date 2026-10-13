1.
[
  {
    "database_name": "postgres",
    "executed_as": "postgres",
    "postgres_version": "PostgreSQL 17.11 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit",
    "database_size": "30 MB",
    "database_size_bytes": 31684275,
    "audited_at_utc": "2026-10-13 08:25:18.861272"
  }
]

2.
[
  {
    "name": "effective_cache_size",
    "setting": "98304",
    "unit": "8kB",
    "source": "configuration file"
  },
  {
    "name": "idle_in_transaction_session_timeout",
    "setting": "0",
    "unit": "ms",
    "source": "default"
  },
  {
    "name": "lock_timeout",
    "setting": "0",
    "unit": "ms",
    "source": "default"
  },
  {
    "name": "maintenance_work_mem",
    "setting": "65536",
    "unit": "kB",
    "source": "configuration file"
  },
  {
    "name": "max_connections",
    "setting": "60",
    "unit": null,
    "source": "configuration file"
  },
  {
    "name": "random_page_cost",
    "setting": "1.1",
    "unit": null,
    "source": "configuration file"
  },
  {
    "name": "shared_buffers",
    "setting": "32768",
    "unit": "8kB",
    "source": "configuration file"
  },
  {
    "name": "statement_timeout",
    "setting": "120000",
    "unit": "ms",
    "source": "configuration file"
  },
  {
    "name": "TimeZone",
    "setting": "UTC",
    "unit": null,
    "source": "configuration file"
  },
  {
    "name": "work_mem",
    "setting": "3500",
    "unit": "kB",
    "source": "configuration file"
  }
]

3.
[
  {
    "extname": "pg_net",
    "extversion": "0.20.4",
    "schema_name": "extensions"
  },
  {
    "extname": "pg_stat_statements",
    "extversion": "1.11",
    "schema_name": "extensions"
  },
  {
    "extname": "pg_trgm",
    "extversion": "1.6",
    "schema_name": "public"
  },
  {
    "extname": "pgcrypto",
    "extversion": "1.3",
    "schema_name": "extensions"
  },
  {
    "extname": "plpgsql",
    "extversion": "1.0",
    "schema_name": "pg_catalog"
  },
  {
    "extname": "supabase_vault",
    "extversion": "0.3.1",
    "schema_name": "vault"
  },
  {
    "extname": "uuid-ossp",
    "extversion": "1.1",
    "schema_name": "extensions"
  }
]

4.
[
  {
    "schemaname": "public",
    "table_name": "activity_log",
    "estimated_live_rows": 2855,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "5440 kB",
    "total_size_bytes": 5570560,
    "last_vacuum": null,
    "last_autovacuum": "2026-10-13 08:02:01.429279+00",
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.457185+00"
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "estimated_live_rows": 362,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "2096 kB",
    "total_size_bytes": 2146304,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.480773+00"
  },
  {
    "schemaname": "public",
    "table_name": "integration_outbox",
    "estimated_live_rows": 338,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "1096 kB",
    "total_size_bytes": 1122304,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.674462+00"
  },
  {
    "schemaname": "public",
    "table_name": "bill_document_extractions",
    "estimated_live_rows": 33,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "1072 kB",
    "total_size_bytes": 1097728,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "lead_ingestions",
    "estimated_live_rows": 354,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "1000 kB",
    "total_size_bytes": 1024000,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.682102+00"
  },
  {
    "schemaname": "public",
    "table_name": "subitems",
    "estimated_live_rows": 102,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "880 kB",
    "total_size_bytes": 901120,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.703759+00"
  },
  {
    "schemaname": "public",
    "table_name": "email_review_queue",
    "estimated_live_rows": 135,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "624 kB",
    "total_size_bytes": 638976,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.656503+00"
  },
  {
    "schemaname": "public",
    "table_name": "integration_inbound_events",
    "estimated_live_rows": 542,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "600 kB",
    "total_size_bytes": 614400,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.66988+00"
  },
  {
    "schemaname": "public",
    "table_name": "industry_options",
    "estimated_live_rows": 988,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "544 kB",
    "total_size_bytes": 557056,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.664131+00"
  },
  {
    "schemaname": "public",
    "table_name": "notifications",
    "estimated_live_rows": 405,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "312 kB",
    "total_size_bytes": 319488,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.685239+00"
  },
  {
    "schemaname": "public",
    "table_name": "client_assignees",
    "estimated_live_rows": 367,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "200 kB",
    "total_size_bytes": 204800,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.459773+00"
  },
  {
    "schemaname": "public",
    "table_name": "subitem_assignees",
    "estimated_live_rows": 207,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "160 kB",
    "total_size_bytes": 163840,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.689178+00"
  },
  {
    "schemaname": "public",
    "table_name": "customer_profile_lead_links",
    "estimated_live_rows": 72,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "128 kB",
    "total_size_bytes": 131072,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.651163+00"
  },
  {
    "schemaname": "public",
    "table_name": "option_values",
    "estimated_live_rows": 169,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "120 kB",
    "total_size_bytes": 122880,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.68741+00"
  },
  {
    "schemaname": "public",
    "table_name": "order_confirmations",
    "estimated_live_rows": 18,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "112 kB",
    "total_size_bytes": 114688,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "additional_costs",
    "estimated_live_rows": 38,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "104 kB",
    "total_size_bytes": 106496,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "customer_client_profile_phone_numbers",
    "estimated_live_rows": 142,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "104 kB",
    "total_size_bytes": 106496,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.644968+00"
  },
  {
    "schemaname": "public",
    "table_name": "shipper_shipment_items",
    "estimated_live_rows": 16,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "96 kB",
    "total_size_bytes": 98304,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "estimate_generations",
    "estimated_live_rows": 7,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "80 kB",
    "total_size_bytes": 81920,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "shipper_spreadsheet_rows",
    "estimated_live_rows": 21,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "80 kB",
    "total_size_bytes": 81920,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "quickbooks_estimate_invoices",
    "estimated_live_rows": 1,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "80 kB",
    "total_size_bytes": 81920,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "customer_client_profiles",
    "estimated_live_rows": 142,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "72 kB",
    "total_size_bytes": 73728,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.646969+00"
  },
  {
    "schemaname": "public",
    "table_name": "customer_company_profiles",
    "estimated_live_rows": 130,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "72 kB",
    "total_size_bytes": 73728,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.649258+00"
  },
  {
    "schemaname": "public",
    "table_name": "shipper_shipments",
    "estimated_live_rows": 12,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "72 kB",
    "total_size_bytes": 73728,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "sales_round_robin_pool",
    "estimated_live_rows": 7,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "64 kB",
    "total_size_bytes": 65536,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "estimate_generation_subitems",
    "estimated_live_rows": 12,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "64 kB",
    "total_size_bytes": 65536,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "profiles",
    "estimated_live_rows": 13,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "64 kB",
    "total_size_bytes": 65536,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "shipper_view_rows",
    "estimated_live_rows": 11,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "64 kB",
    "total_size_bytes": 65536,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "subitem_payment_rows",
    "estimated_live_rows": 61,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "64 kB",
    "total_size_bytes": 65536,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.690897+00"
  },
  {
    "schemaname": "public",
    "table_name": "supplier_profile_products",
    "estimated_live_rows": 6,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "64 kB",
    "total_size_bytes": 65536,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "working_calendar_days",
    "estimated_live_rows": 26,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "64 kB",
    "total_size_bytes": 65536,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "supplier_tag_options",
    "estimated_live_rows": 83,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "56 kB",
    "total_size_bytes": 57344,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.744987+00"
  },
  {
    "schemaname": "public",
    "table_name": "crm_bin_purge_log",
    "estimated_live_rows": 88,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "56 kB",
    "total_size_bytes": 57344,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": "2026-10-13 08:02:01.643432+00"
  },
  {
    "schemaname": "public",
    "table_name": "additional_cost_activity_log",
    "estimated_live_rows": 11,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "48 kB",
    "total_size_bytes": 49152,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "supplier_profiles",
    "estimated_live_rows": 3,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "48 kB",
    "total_size_bytes": 49152,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "shippers",
    "estimated_live_rows": 3,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "48 kB",
    "total_size_bytes": 49152,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "option_groups",
    "estimated_live_rows": 24,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "48 kB",
    "total_size_bytes": 49152,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "shipper_workbooks",
    "estimated_live_rows": 3,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "48 kB",
    "total_size_bytes": 49152,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "app_settings",
    "estimated_live_rows": 3,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "48 kB",
    "total_size_bytes": 49152,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "client_updates",
    "estimated_live_rows": 2,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "48 kB",
    "total_size_bytes": 49152,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "shipper_staging_rows",
    "estimated_live_rows": 5,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "48 kB",
    "total_size_bytes": 49152,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "supplier_profile_tags",
    "estimated_live_rows": 20,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "40 kB",
    "total_size_bytes": 40960,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "user_settings",
    "estimated_live_rows": 44,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "40 kB",
    "total_size_bytes": 40960,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "quickbooks_connections",
    "estimated_live_rows": 1,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "32 kB",
    "total_size_bytes": 32768,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "crm_groups",
    "estimated_live_rows": 11,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "32 kB",
    "total_size_bytes": 32768,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "order_confirmation_items",
    "estimated_live_rows": 21,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "32 kB",
    "total_size_bytes": 32768,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "customer_profile_remarks",
    "estimated_live_rows": 0,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0",
    "total_size": "32 kB",
    "total_size_bytes": 32768,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "sales_round_robin_pointer_state",
    "estimated_live_rows": 1,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "24 kB",
    "total_size_bytes": 24576,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "sales_round_robin_state",
    "estimated_live_rows": 1,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "24 kB",
    "total_size_bytes": 24576,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "sample_estimate_sequence",
    "estimated_live_rows": 1,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0.00",
    "total_size": "24 kB",
    "total_size_bytes": 24576,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "user_table_prefs",
    "estimated_live_rows": 0,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0",
    "total_size": "24 kB",
    "total_size_bytes": 24576,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "supplier_profile_remarks",
    "estimated_live_rows": 0,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0",
    "total_size": "24 kB",
    "total_size_bytes": 24576,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "custom_columns",
    "estimated_live_rows": 0,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0",
    "total_size": "16 kB",
    "total_size_bytes": 16384,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  },
  {
    "schemaname": "public",
    "table_name": "gantt_client_pins",
    "estimated_live_rows": 0,
    "estimated_dead_rows": 0,
    "dead_tuple_percent": "0",
    "total_size": "16 kB",
    "total_size_bytes": 16384,
    "last_vacuum": null,
    "last_autovacuum": null,
    "last_analyze": null,
    "last_autoanalyze": null
  }
]

5.
[
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_email_trgm_idx",
    "index_size": "360 kB",
    "index_size_bytes": 368640,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_name_trgm_idx",
    "index_size": "224 kB",
    "index_size_bytes": 229376,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "activity_log",
    "index_name": "Activity Log_pkey",
    "index_size": "144 kB",
    "index_size_bytes": 147456,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "subitems",
    "index_name": "subitems_name_trgm_idx",
    "index_size": "128 kB",
    "index_size_bytes": 131072,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_company_trgm_idx",
    "index_size": "128 kB",
    "index_size_bytes": 131072,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "industry_options",
    "index_name": "industry_options_name_search_idx",
    "index_size": "120 kB",
    "index_size_bytes": 122880,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_custom_fields_gin_idx",
    "index_size": "96 kB",
    "index_size_bytes": 98304,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_phone_trgm_idx",
    "index_size": "96 kB",
    "index_size_bytes": 98304,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "notifications",
    "index_name": "notifications_user_dedupe_key",
    "index_size": "80 kB",
    "index_size_bytes": 81920,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "notifications",
    "index_name": "notifications_dedupe_key_unique_idx",
    "index_size": "72 kB",
    "index_size_bytes": 73728,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "subitems",
    "index_name": "subitems_description_trgm_idx",
    "index_size": "72 kB",
    "index_size_bytes": 73728,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "client_assignees",
    "index_name": "client_assignees_user_assignment_type_idx",
    "index_size": "56 kB",
    "index_size_bytes": 57344,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "integration_outbox",
    "index_name": "integration_outbox_dedupe_key_key",
    "index_size": "56 kB",
    "index_size_bytes": 57344,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "industry_options",
    "index_name": "industry_options_classification_classification_year_code_key",
    "index_size": "56 kB",
    "index_size_bytes": 57344,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "industry_options",
    "index_name": "industry_options_pkey",
    "index_size": "56 kB",
    "index_size_bytes": 57344,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_filter_status_idx",
    "index_size": "48 kB",
    "index_size_bytes": 49152,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_filter_channel_idx",
    "index_size": "48 kB",
    "index_size_bytes": 49152,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_active_group_created_cursor_idx",
    "index_size": "48 kB",
    "index_size_bytes": 49152,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "client_assignees",
    "index_name": "client_assignees_pkey",
    "index_size": "48 kB",
    "index_size_bytes": 49152,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_group_created_at_idx",
    "index_size": "48 kB",
    "index_size_bytes": 49152,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "industry_options",
    "index_name": "industry_options_code_idx",
    "index_size": "48 kB",
    "index_size_bytes": 49152,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "subitem_assignees",
    "index_name": "subitem_assignees_subitem_user_idx",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_filter_importance_idx",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "integration_outbox",
    "index_name": "integration_outbox_delivery_idx",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "subitem_assignees",
    "index_name": "subitem_assignees_subitem_user_unique",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "integration_outbox",
    "index_name": "integration_outbox_pkey",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_display_id_key",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "lead_ingestions",
    "index_name": "lead_ingestions_source_external_key",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "lead_ingestions",
    "index_name": "lead_ingestions_client_id_idx",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "lead_ingestions",
    "index_name": "lead_ingestions_status_updated_idx",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "client_assignees",
    "index_name": "client_assignees_client_user_idx",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "subitem_assignees",
    "index_name": "subitem_assignees_pkey",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "option_values",
    "index_name": "option_values_group_system_key_idx",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "notifications",
    "index_name": "notifications_pkey",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "integration_inbound_events",
    "index_name": "integration_inbound_events_provider_external_event_id_key",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "integration_inbound_events",
    "index_name": "integration_inbound_events_pkey",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "lead_ingestions",
    "index_name": "lead_ingestions_pkey",
    "index_size": "40 kB",
    "index_size_bytes": 40960,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_pkey",
    "index_size": "32 kB",
    "index_size_bytes": 32768,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "subitems",
    "index_name": "subitems_remarks_trgm_idx",
    "index_size": "24 kB",
    "index_size_bytes": 24576,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "subitems",
    "index_name": "subitems_custom_fields_gin_idx",
    "index_size": "24 kB",
    "index_size_bytes": 24576,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "subitems",
    "index_name": "subitems_supplier_trgm_idx",
    "index_size": "24 kB",
    "index_size_bytes": 24576,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "additional_costs",
    "index_name": "additional_costs_client_position_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "additional_costs",
    "index_name": "additional_costs_created_at_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "additional_costs",
    "index_name": "additional_costs_deleted_at_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "additional_costs",
    "index_name": "additional_costs_voucher_group_created_at_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "client_assignees",
    "index_name": "idx_client_assignees_profile_id",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "additional_cost_activity_log",
    "index_name": "additional_cost_activity_log_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "additional_cost_activity_log",
    "index_name": "additional_cost_activity_log_voucher_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "bill_document_extractions",
    "index_name": "bill_document_extractions_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "bill_document_extractions",
    "index_name": "bill_document_extractions_client_created_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_client_profile_phone_numbers",
    "index_name": "customer_client_profile_phone_numbers_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_client_profile_phone_numbers",
    "index_name": "customer_client_profile_phone_numbers_profile_number",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_client_profile_phone_numbers",
    "index_name": "customer_client_profile_phone_numbers_unique_number",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_client_profile_phone_numbers",
    "index_name": "customer_client_profile_phone_numbers_one_primary_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_client_profile_phone_numbers",
    "index_name": "customer_client_profile_phone_numbers_profile_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_client_profiles",
    "index_name": "customer_client_profiles_phone_number_key",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_client_profiles",
    "index_name": "customer_client_profiles_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_company_profiles",
    "index_name": "customer_company_profiles_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_company_profiles",
    "index_name": "customer_company_profiles_industry_option_id_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_company_profiles",
    "index_name": "customer_company_profiles_name_lower_key",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_profile_lead_links",
    "index_name": "customer_profile_lead_links_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_profile_lead_links",
    "index_name": "customer_profile_lead_links_client_id_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_profile_lead_links",
    "index_name": "customer_profile_lead_links_client_profile_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_profile_lead_links",
    "index_name": "customer_profile_lead_links_client_profile_unique",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_profile_lead_links",
    "index_name": "customer_profile_lead_links_company_profile_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_profile_lead_links",
    "index_name": "customer_profile_lead_links_primary_client_unique",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "customer_profile_lead_links",
    "index_name": "customer_profile_lead_links_primary_company_unique",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "shippers",
    "index_name": "suppliers_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "client_updates",
    "index_name": "client_updates_client_created_at_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "crm_bin_purge_log",
    "index_name": "crm_bin_purge_log_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "crm_bin_purge_log",
    "index_name": "crm_bin_purge_log_purged_at_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_channel_option_id_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_deleted_at_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_deletion_owner_id_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_importance_option_id_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_progress_option_id_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_reply_status_option_id_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "clients",
    "index_name": "clients_status_option_id_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "crm_groups",
    "index_name": "crm_groups_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "quickbooks_estimate_invoices",
    "index_name": "quickbooks_estimate_invoices_estimate_generation_id_quickbo_key",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "quickbooks_estimate_invoices",
    "index_name": "quickbooks_estimate_invoices_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "quickbooks_estimate_invoices",
    "index_name": "quickbooks_estimate_invoices_generation_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "quickbooks_estimate_invoices",
    "index_name": "quickbooks_estimate_invoices_invoice_id_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "sales_round_robin_pointer_state",
    "index_name": "sales_round_robin_pointer_state_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "sales_round_robin_pool",
    "index_name": "sales_round_robin_pool_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "sales_round_robin_pool",
    "index_name": "sales_round_robin_pool_position_key",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "sales_round_robin_pool",
    "index_name": "sales_round_robin_pool_user_id_key",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "sample_estimate_sequence",
    "index_name": "sample_estimate_sequence_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "shipper_shipment_items",
    "index_name": "shipper_shipment_items_legacy_shipper_view_row_id_key",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "shipper_shipment_items",
    "index_name": "shipper_shipment_items_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "shipper_shipment_items",
    "index_name": "shipper_shipment_items_shipment_id_position_key",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "shipper_shipment_items",
    "index_name": "shipper_shipment_items_shipment_id_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "shipper_shipment_items",
    "index_name": "shipper_shipment_items_subitem_id_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "shipper_shipments",
    "index_name": "shipper_shipments_legacy_shipper_view_row_id_key",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "shipper_shipments",
    "index_name": "shipper_shipments_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "shipper_shipments",
    "index_name": "shipper_shipments_shipper_id_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "shipper_spreadsheet_rows",
    "index_name": "shipper_spreadsheet_rows_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "shipper_spreadsheet_rows",
    "index_name": "shipper_spreadsheet_rows_source_subitem_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "shipper_spreadsheet_rows",
    "index_name": "shipper_spreadsheet_rows_workbook_order_idx",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  },
  {
    "schemaname": "public",
    "table_name": "shipper_staging_rows",
    "index_name": "shipper_staging_rows_pkey",
    "index_size": "16 kB",
    "index_size_bytes": 16384,
    "idx_scan": 0
  }
]

6.
[
  {
    "table_name": "public.activity_log",
    "row_count": 2855
  },
  {
    "table_name": "public.additional_cost_activity_log",
    "row_count": 11
  },
  {
    "table_name": "public.additional_costs",
    "row_count": 38
  },
  {
    "table_name": "public.app_settings",
    "row_count": 3
  },
  {
    "table_name": "public.bill_document_extractions",
    "row_count": 33
  },
  {
    "table_name": "public.client_assignees",
    "row_count": 367
  },
  {
    "table_name": "public.client_updates",
    "row_count": 2
  },
  {
    "table_name": "public.clients",
    "row_count": 362
  },
  {
    "table_name": "public.crm_bin_purge_log",
    "row_count": 88
  },
  {
    "table_name": "public.crm_groups",
    "row_count": 11
  },
  {
    "table_name": "public.custom_columns",
    "row_count": 0
  },
  {
    "table_name": "public.customer_client_profile_phone_numbers",
    "row_count": 142
  },
  {
    "table_name": "public.customer_client_profiles",
    "row_count": 142
  },
  {
    "table_name": "public.customer_company_profiles",
    "row_count": 130
  },
  {
    "table_name": "public.customer_profile_lead_links",
    "row_count": 72
  },
  {
    "table_name": "public.customer_profile_remarks",
    "row_count": 0
  },
  {
    "table_name": "public.email_review_queue",
    "row_count": 135
  },
  {
    "table_name": "public.estimate_generation_subitems",
    "row_count": 12
  },
  {
    "table_name": "public.estimate_generations",
    "row_count": 7
  },
  {
    "table_name": "public.gantt_client_pins",
    "row_count": 0
  },
  {
    "table_name": "public.industry_options",
    "row_count": 988
  },
  {
    "table_name": "public.integration_inbound_events",
    "row_count": 542
  },
  {
    "table_name": "public.integration_outbox",
    "row_count": 338
  },
  {
    "table_name": "public.lead_ingestions",
    "row_count": 354
  },
  {
    "table_name": "public.notifications",
    "row_count": 405
  },
  {
    "table_name": "public.option_groups",
    "row_count": 24
  },
  {
    "table_name": "public.option_values",
    "row_count": 169
  },
  {
    "table_name": "public.order_confirmation_items",
    "row_count": 21
  },
  {
    "table_name": "public.order_confirmations",
    "row_count": 18
  },
  {
    "table_name": "public.profiles",
    "row_count": 13
  },
  {
    "table_name": "public.quickbooks_connections",
    "row_count": 1
  },
  {
    "table_name": "public.quickbooks_estimate_invoices",
    "row_count": 1
  },
  {
    "table_name": "public.sales_round_robin_pointer_state",
    "row_count": 1
  },
  {
    "table_name": "public.sales_round_robin_pool",
    "row_count": 7
  },
  {
    "table_name": "public.sales_round_robin_state",
    "row_count": 1
  },
  {
    "table_name": "public.sample_estimate_sequence",
    "row_count": 1
  },
  {
    "table_name": "public.shipper_shipment_items",
    "row_count": 16
  },
  {
    "table_name": "public.shipper_shipments",
    "row_count": 12
  },
  {
    "table_name": "public.shipper_spreadsheet_rows",
    "row_count": 21
  },
  {
    "table_name": "public.shipper_staging_rows",
    "row_count": 5
  },
  {
    "table_name": "public.shipper_view_rows",
    "row_count": 11
  },
  {
    "table_name": "public.shipper_workbooks",
    "row_count": 3
  },
  {
    "table_name": "public.shippers",
    "row_count": 3
  },
  {
    "table_name": "public.subitem_assignees",
    "row_count": 207
  },
  {
    "table_name": "public.subitem_payment_rows",
    "row_count": 61
  },
  {
    "table_name": "public.subitems",
    "row_count": 102
  },
  {
    "table_name": "public.supplier_profile_products",
    "row_count": 6
  },
  {
    "table_name": "public.supplier_profile_remarks",
    "row_count": 0
  },
  {
    "table_name": "public.supplier_profile_tags",
    "row_count": 20
  },
  {
    "table_name": "public.supplier_profiles",
    "row_count": 3
  },
  {
    "table_name": "public.supplier_tag_options",
    "row_count": 83
  },
  {
    "table_name": "public.user_settings",
    "row_count": 44
  },
  {
    "table_name": "public.user_table_prefs",
    "row_count": 0
  },
  {
    "table_name": "public.working_calendar_days",
    "row_count": 26
  }
]

7.
[
  {
    "schema_name": "private",
    "function_name": "can_access_shipment",
    "identity_arguments": "target_shipment_id uuid",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "private",
    "function_name": "can_access_shipper",
    "identity_arguments": "target_shipper_id uuid",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "private",
    "function_name": "can_delete_crm_row",
    "identity_arguments": "row_created_at timestamp with time zone, row_deletion_owner_id uuid",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "private",
    "function_name": "can_edit_client",
    "identity_arguments": "target_client_id uuid",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "private",
    "function_name": "can_edit_order_confirmation",
    "identity_arguments": "target_ocf_id uuid",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "private",
    "function_name": "can_edit_subitem",
    "identity_arguments": "target_subitem_id uuid, target_client_id uuid",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "private",
    "function_name": "can_manage_round_robin",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "private",
    "function_name": "can_upload_crm_file",
    "identity_arguments": "object_name text",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "private",
    "function_name": "can_upload_ocf_item_image",
    "identity_arguments": "object_name text",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "private",
    "function_name": "can_write_activity",
    "identity_arguments": "target_client_id uuid, target_subitem_id uuid",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "private",
    "function_name": "current_app_role",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "private",
    "function_name": "current_shipper_id",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "private",
    "function_name": "guard_shipper_shipment_columns",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "private",
    "function_name": "is_configuration_manager",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "private",
    "function_name": "is_internal_profile",
    "identity_arguments": "target_user_id uuid",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "private",
    "function_name": "is_internal_user",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "private",
    "function_name": "is_shipment_staff",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "assign_lead_ingestion_sales_user",
    "identity_arguments": "ingestion_id uuid",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "can_manage_quickbooks_bills_only",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "can_manage_working_calendar",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "create_quickbooks_bills_only_voucher",
    "identity_arguments": "p_cost numeric, p_reference_id text, p_quickbooks_bill_id text, p_invoice_number text, p_supplier_id text, p_supplier_name text, p_attachment_files jsonb",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_client_group_counts",
    "identity_arguments": "p_search text, p_status_option_id uuid, p_importance_option_id uuid, p_reply_status_option_id uuid, p_channel_option_id uuid, p_subitem_status_option_id uuid, p_payment_option_id uuid, p_payment_status_option_id uuid, p_person_id uuid",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_client_group_counts_v2",
    "identity_arguments": "p_search text, p_search_columns text[], p_advanced_rules jsonb, p_advanced_join text, p_status_option_id uuid, p_importance_option_id uuid, p_reply_status_option_id uuid, p_channel_option_id uuid, p_subitem_status_option_id uuid, p_payment_option_id uuid, p_payment_status_option_id uuid, p_subprogress_option_id uuid, p_person_id uuid",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_client_group_counts_v3",
    "identity_arguments": "p_search text, p_search_columns text[], p_advanced_rules jsonb, p_advanced_join text, p_status_option_id uuid, p_importance_option_id uuid, p_reply_status_option_id uuid, p_channel_option_id uuid, p_subitem_status_option_id uuid, p_payment_option_id uuid, p_payment_status_option_id uuid, p_subprogress_option_id uuid, p_person_id uuid",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_client_matches_v2",
    "identity_arguments": "p_client_id uuid, p_search text, p_search_columns text[], p_advanced_rules jsonb, p_advanced_join text, p_status_option_id uuid, p_importance_option_id uuid, p_reply_status_option_id uuid, p_channel_option_id uuid, p_subitem_status_option_id uuid, p_payment_option_id uuid, p_payment_status_option_id uuid, p_subprogress_option_id uuid, p_person_id uuid",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_client_page",
    "identity_arguments": "p_group_id uuid, p_limit integer, p_offset integer, p_search text, p_sort_field text, p_sort_direction text, p_status_option_id uuid, p_importance_option_id uuid, p_reply_status_option_id uuid, p_channel_option_id uuid, p_subitem_status_option_id uuid, p_payment_option_id uuid, p_payment_status_option_id uuid, p_person_id uuid",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_client_page_hydrated_v1",
    "identity_arguments": "p_group_id uuid, p_limit integer, p_offset integer, p_search text, p_search_columns text[], p_sort_category text, p_sort_column text, p_sort_value_type text, p_sort_direction text, p_advanced_rules jsonb, p_advanced_join text, p_status_option_id uuid, p_importance_option_id uuid, p_reply_status_option_id uuid, p_channel_option_id uuid, p_subitem_status_option_id uuid, p_payment_option_id uuid, p_payment_status_option_id uuid, p_subprogress_option_id uuid, p_person_id uuid, p_exclude_group_names text[]",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_client_page_hydrated_v2",
    "identity_arguments": "p_group_id uuid, p_limit integer, p_offset integer, p_search text, p_search_columns text[], p_sort_category text, p_sort_column text, p_sort_value_type text, p_sort_direction text, p_advanced_rules jsonb, p_advanced_join text, p_status_option_id uuid, p_importance_option_id uuid, p_reply_status_option_id uuid, p_channel_option_id uuid, p_subitem_status_option_id uuid, p_payment_option_id uuid, p_payment_status_option_id uuid, p_subprogress_option_id uuid, p_person_id uuid",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_client_page_hydrated_v3",
    "identity_arguments": "p_group_id uuid, p_limit integer, p_offset integer, p_search text, p_search_columns text[], p_sort_category text, p_sort_column text, p_sort_value_type text, p_sort_direction text, p_advanced_rules jsonb, p_advanced_join text, p_status_option_id uuid, p_importance_option_id uuid, p_reply_status_option_id uuid, p_channel_option_id uuid, p_subitem_status_option_id uuid, p_payment_option_id uuid, p_payment_status_option_id uuid, p_subprogress_option_id uuid, p_person_id uuid",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_client_page_v2",
    "identity_arguments": "p_group_id uuid, p_limit integer, p_offset integer, p_search text, p_search_columns text[], p_sort_category text, p_sort_column text, p_sort_value_type text, p_sort_direction text, p_advanced_rules jsonb, p_advanced_join text, p_status_option_id uuid, p_importance_option_id uuid, p_reply_status_option_id uuid, p_channel_option_id uuid, p_subitem_status_option_id uuid, p_payment_option_id uuid, p_payment_status_option_id uuid, p_subprogress_option_id uuid, p_person_id uuid",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_client_page_v3",
    "identity_arguments": "p_group_id uuid, p_limit integer, p_offset integer, p_search text, p_search_columns text[], p_sort_category text, p_sort_column text, p_sort_value_type text, p_sort_direction text, p_advanced_rules jsonb, p_advanced_join text, p_status_option_id uuid, p_importance_option_id uuid, p_reply_status_option_id uuid, p_channel_option_id uuid, p_subitem_status_option_id uuid, p_payment_option_id uuid, p_payment_status_option_id uuid, p_subprogress_option_id uuid, p_person_id uuid",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_column_values",
    "identity_arguments": "p_client_id uuid, p_column text",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_initial_page_hydrated_v1",
    "identity_arguments": "p_limit integer, p_offset integer, p_exclude_group_names text[]",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_numeric",
    "identity_arguments": "p_value text",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_quick_filter_counts_v2",
    "identity_arguments": "p_search text, p_search_columns text[], p_advanced_rules jsonb, p_advanced_join text, p_status_option_id uuid, p_importance_option_id uuid, p_reply_status_option_id uuid, p_channel_option_id uuid, p_subitem_status_option_id uuid, p_payment_option_id uuid, p_payment_status_option_id uuid, p_subprogress_option_id uuid, p_person_id uuid",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_standard_matched_clients_v1",
    "identity_arguments": "p_search text, p_status_option_id uuid, p_importance_option_id uuid, p_reply_status_option_id uuid, p_channel_option_id uuid, p_subitem_status_option_id uuid, p_payment_option_id uuid, p_payment_status_option_id uuid, p_subprogress_option_id uuid, p_person_id uuid",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_storage_key",
    "identity_arguments": "p_key text",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_values_match",
    "identity_arguments": "p_values text[], p_condition text, p_query text",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "crm_board_values_match",
    "identity_arguments": "p_values text[], p_condition text, p_query text, p_value_type text",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "crm_hydrate_board_clients_v1",
    "identity_arguments": "p_client_ids uuid[]",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_hydrate_clients_v1",
    "identity_arguments": "p_client_ids uuid[]",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_hydrate_subitem_details_v1",
    "identity_arguments": "p_subitem_ids uuid[]",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_hydrate_subitem_details_v2",
    "identity_arguments": "p_subitem_ids uuid[]",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "crm_universal_search_clients",
    "identity_arguments": "p_search text, p_limit integer",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "current_user_is_crm_admin",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "gantt_client_filter_options",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "gantt_resource_page",
    "identity_arguments": "p_limit integer, p_after_group_sort integer, p_after_client_created_at timestamp with time zone, p_after_client_id uuid, p_after_subitem_position integer, p_after_subitem_id uuid, p_after_timeline_index integer, p_search text, p_search_scope text, p_group_ids uuid[], p_client_ids uuid[], p_pm_ids uuid[], p_people_ids uuid[], p_process_statuses text[], p_date_from date, p_date_to date",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "get_next_sales_assignee",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "get_sales_round_robin_pointer",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "get_sales_round_robin_queue",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "gin_extract_query_trgm",
    "identity_arguments": "text, internal, smallint, internal, internal, internal, internal",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "gin_extract_value_trgm",
    "identity_arguments": "text, internal",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "gin_trgm_consistent",
    "identity_arguments": "internal, smallint, text, integer, internal, internal, internal, internal",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "gin_trgm_triconsistent",
    "identity_arguments": "internal, smallint, text, integer, internal, internal, internal",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "gtrgm_compress",
    "identity_arguments": "internal",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "gtrgm_consistent",
    "identity_arguments": "internal, text, smallint, oid, internal",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "gtrgm_decompress",
    "identity_arguments": "internal",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "gtrgm_distance",
    "identity_arguments": "internal, text, smallint, oid, internal",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "gtrgm_in",
    "identity_arguments": "cstring",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "gtrgm_options",
    "identity_arguments": "internal",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "gtrgm_out",
    "identity_arguments": "gtrgm",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "gtrgm_penalty",
    "identity_arguments": "internal, internal, internal",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "gtrgm_picksplit",
    "identity_arguments": "internal, internal",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "gtrgm_same",
    "identity_arguments": "gtrgm, gtrgm, internal",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "gtrgm_union",
    "identity_arguments": "internal, internal",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "handle_new_user",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "next_payment_voucher_reference_id",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "next_sample_estimate_number",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "prevent_locked_client_subitem_updates",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "prevent_system_label_deletion",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "refresh_tracking_client_totals",
    "identity_arguments": "p_client_id uuid",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "refresh_tracking_client_totals_from_invoice",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "refresh_tracking_client_totals_from_quote",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "refresh_tracking_client_totals_from_subitem",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "reorder_client_subitems",
    "identity_arguments": "target_client_id uuid, ordered_subitem_ids uuid[]",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "replace_customer_client_profile_phone_numbers",
    "identity_arguments": "target_profile_id uuid, phone_entries jsonb",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "save_sales_round_robin_layout",
    "identity_arguments": "layout jsonb",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "set_crm_creator_fields",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "set_limit",
    "identity_arguments": "real",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "set_quickbooks_estimate_invoice_updated_at",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "set_sales_round_robin_pointer",
    "identity_arguments": "new_position integer",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "set_shipper_spreadsheet_updated_at",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "set_system_client_deletion_owner",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "set_system_subitem_deletion_owner",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "show_limit",
    "identity_arguments": "",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "show_trgm",
    "identity_arguments": "text",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "similarity",
    "identity_arguments": "text, text",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "similarity_dist",
    "identity_arguments": "text, text",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "similarity_op",
    "identity_arguments": "text, text",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "strict_word_similarity",
    "identity_arguments": "text, text",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "strict_word_similarity_commutator_op",
    "identity_arguments": "text, text",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "strict_word_similarity_dist_commutator_op",
    "identity_arguments": "text, text",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "strict_word_similarity_dist_op",
    "identity_arguments": "text, text",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "strict_word_similarity_op",
    "identity_arguments": "text, text",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "swap_sales_round_robin_positions",
    "identity_arguments": "first_user_id uuid, second_user_id uuid",
    "owner": "postgres",
    "security_definer": false,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "update_client_progress_when_timelines_delivered",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": true,
    "volatility": "v"
  },
  {
    "schema_name": "public",
    "function_name": "word_similarity",
    "identity_arguments": "text, text",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "word_similarity_commutator_op",
    "identity_arguments": "text, text",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "s"
  },
  {
    "schema_name": "public",
    "function_name": "word_similarity_dist_commutator_op",
    "identity_arguments": "text, text",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "word_similarity_dist_op",
    "identity_arguments": "text, text",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "i"
  },
  {
    "schema_name": "public",
    "function_name": "word_similarity_op",
    "identity_arguments": "text, text",
    "owner": "supabase_admin",
    "security_definer": false,
    "volatility": "s"
  }
]

8.
[
  {
    "schemaname": "public",
    "tablename": "activity_log",
    "policyname": "activity_log_insert_assigned",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "private.can_write_activity(client_id, subitem_id)"
  },
  {
    "schemaname": "public",
    "tablename": "activity_log",
    "policyname": "activity_log_insert_by_record_editor",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "((EXISTS ( SELECT 1\n   FROM profiles profile\n  WHERE ((profile.id = auth.uid()) AND (lower(COALESCE(profile.role, ''::text)) = ANY (ARRAY['admin'::text, 'director'::text, 'dev'::text]))))) OR (EXISTS ( SELECT 1\n   FROM client_assignees assignment\n  WHERE ((assignment.client_id = activity_log.client_id) AND (assignment.user_id = auth.uid())))) OR ((subitem_id IS NOT NULL) AND (EXISTS ( SELECT 1\n   FROM subitem_assignees assignment\n  WHERE ((assignment.subitem_id = activity_log.subitem_id) AND (assignment.user_id = auth.uid()))))))"
  },
  {
    "schemaname": "public",
    "tablename": "activity_log",
    "policyname": "activity_log_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "activity_log",
    "policyname": "activity_log_update_assigned",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "private.can_write_activity(client_id, subitem_id)",
    "with_check": "private.can_write_activity(client_id, subitem_id)"
  },
  {
    "schemaname": "public",
    "tablename": "additional_costs",
    "policyname": "quickbooks_bills_only_payment_vouchers",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "((voucher_group = 'quickbooks_bills_only'::text) AND can_manage_quickbooks_bills_only())",
    "with_check": "((voucher_group = 'quickbooks_bills_only'::text) AND (client_id IS NULL) AND can_manage_quickbooks_bills_only())"
  },
  {
    "schemaname": "public",
    "tablename": "app_settings",
    "policyname": "app_settings_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "app_settings",
    "policyname": "app_settings_write_configuration_manager",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "private.is_configuration_manager()",
    "with_check": "private.is_configuration_manager()"
  },
  {
    "schemaname": "public",
    "tablename": "client_assignees",
    "policyname": "client_assignees_delete_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "client_assignees",
    "policyname": "client_assignees_insert_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(private.is_internal_user() AND private.is_internal_profile(user_id))"
  },
  {
    "schemaname": "public",
    "tablename": "client_assignees",
    "policyname": "client_assignees_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "client_assignees",
    "policyname": "crm_admin_delete_client_assignees",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "current_user_is_crm_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "client_assignees",
    "policyname": "crm_admin_insert_client_assignees",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "current_user_is_crm_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "client_assignees",
    "policyname": "crm_admin_update_client_assignees",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "current_user_is_crm_admin()",
    "with_check": "current_user_is_crm_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "client_assignees",
    "policyname": "directors_manage_client_assignments",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "(EXISTS ( SELECT 1\n   FROM profiles profile\n  WHERE ((profile.id = auth.uid()) AND (lower(COALESCE(profile.role, ''::text)) = 'director'::text))))",
    "with_check": "(EXISTS ( SELECT 1\n   FROM profiles profile\n  WHERE ((profile.id = auth.uid()) AND (lower(COALESCE(profile.role, ''::text)) = 'director'::text))))"
  },
  {
    "schemaname": "public",
    "tablename": "client_updates",
    "policyname": "client_updates_delete_author_or_manager",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "((author_id = ( SELECT auth.uid() AS uid)) OR private.is_configuration_manager())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "client_updates",
    "policyname": "client_updates_insert_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(private.is_internal_user() AND (author_id = ( SELECT auth.uid() AS uid)))"
  },
  {
    "schemaname": "public",
    "tablename": "client_updates",
    "policyname": "client_updates_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "clients",
    "policyname": "clients_delete_permitted",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "private.can_delete_crm_row(created_at, deletion_owner_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "clients",
    "policyname": "clients_insert_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "private.is_internal_user()"
  },
  {
    "schemaname": "public",
    "tablename": "clients",
    "policyname": "clients_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "clients",
    "policyname": "clients_update_assigned",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "private.can_edit_client(id)",
    "with_check": "private.can_edit_client(id)"
  },
  {
    "schemaname": "public",
    "tablename": "clients",
    "policyname": "crm_admin_update_clients",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "current_user_is_crm_admin()",
    "with_check": "current_user_is_crm_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "clients",
    "policyname": "directors_manage_all_clients",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "(EXISTS ( SELECT 1\n   FROM profiles profile\n  WHERE ((profile.id = auth.uid()) AND (lower(COALESCE(profile.role, ''::text)) = 'director'::text))))",
    "with_check": "(EXISTS ( SELECT 1\n   FROM profiles profile\n  WHERE ((profile.id = auth.uid()) AND (lower(COALESCE(profile.role, ''::text)) = 'director'::text))))"
  },
  {
    "schemaname": "public",
    "tablename": "crm_groups",
    "policyname": "crm_groups_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "crm_groups",
    "policyname": "crm_groups_write_configuration_manager",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "private.is_configuration_manager()",
    "with_check": "private.is_configuration_manager()"
  },
  {
    "schemaname": "public",
    "tablename": "custom_columns",
    "policyname": "custom_columns_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "custom_columns",
    "policyname": "custom_columns_write_configuration_manager",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "private.is_configuration_manager()",
    "with_check": "private.is_configuration_manager()"
  },
  {
    "schemaname": "public",
    "tablename": "estimate_generations",
    "policyname": "estimate_generations_insert_assigned",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "private.can_edit_client(client_id)"
  },
  {
    "schemaname": "public",
    "tablename": "estimate_generations",
    "policyname": "estimate_generations_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "gantt_client_pins",
    "policyname": "Users can create their own Gantt pins",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(auth.uid() = user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "gantt_client_pins",
    "policyname": "Users can read their own Gantt pins",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "gantt_client_pins",
    "policyname": "Users can remove their own Gantt pins",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "industry_options",
    "policyname": "industry_options_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notifications",
    "policyname": "notifications_insert_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(private.is_internal_user() AND private.is_internal_profile(user_id))"
  },
  {
    "schemaname": "public",
    "tablename": "notifications",
    "policyname": "notifications_select_own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(( SELECT auth.uid() AS uid) = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notifications",
    "policyname": "notifications_update_own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "(( SELECT auth.uid() AS uid) = user_id)",
    "with_check": "(( SELECT auth.uid() AS uid) = user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "option_groups",
    "policyname": "option_groups_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "option_groups",
    "policyname": "option_groups_write_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "private.is_internal_user()",
    "with_check": "private.is_internal_user()"
  },
  {
    "schemaname": "public",
    "tablename": "option_values",
    "policyname": "option_values_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "option_values",
    "policyname": "option_values_write_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "private.is_internal_user()",
    "with_check": "private.is_internal_user()"
  },
  {
    "schemaname": "public",
    "tablename": "order_confirmation_items",
    "policyname": "order_confirmation_items_delete_assigned",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "private.can_edit_order_confirmation(order_confirmation_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "order_confirmation_items",
    "policyname": "order_confirmation_items_insert_assigned",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "private.can_edit_order_confirmation(order_confirmation_id)"
  },
  {
    "schemaname": "public",
    "tablename": "order_confirmation_items",
    "policyname": "order_confirmation_items_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "order_confirmation_items",
    "policyname": "order_confirmation_items_update_assigned",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "private.can_edit_order_confirmation(order_confirmation_id)",
    "with_check": "private.can_edit_order_confirmation(order_confirmation_id)"
  },
  {
    "schemaname": "public",
    "tablename": "order_confirmations",
    "policyname": "order_confirmations_delete_assigned",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "private.can_edit_client(client_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "order_confirmations",
    "policyname": "order_confirmations_insert_assigned",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "private.can_edit_client(client_id)"
  },
  {
    "schemaname": "public",
    "tablename": "order_confirmations",
    "policyname": "order_confirmations_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "order_confirmations",
    "policyname": "order_confirmations_update_assigned",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "private.can_edit_client(client_id)",
    "with_check": "private.can_edit_client(client_id)"
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "profiles_select_internal_staff",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "profiles_select_own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(( SELECT auth.uid() AS uid) = id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "quickbooks_estimate_invoices",
    "policyname": "quickbooks_estimate_invoices_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "quickbooks_estimate_invoices",
    "policyname": "quickbooks_estimate_invoices_write_assigned",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "(EXISTS ( SELECT 1\n   FROM estimate_generations generation\n  WHERE ((generation.id = quickbooks_estimate_invoices.estimate_generation_id) AND private.can_edit_client(generation.client_id))))",
    "with_check": "(EXISTS ( SELECT 1\n   FROM estimate_generations generation\n  WHERE ((generation.id = quickbooks_estimate_invoices.estimate_generation_id) AND private.can_edit_client(generation.client_id))))"
  },
  {
    "schemaname": "public",
    "tablename": "sales_round_robin_pointer_state",
    "policyname": "sales_round_robin_pointer_state_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "sales_round_robin_pointer_state",
    "policyname": "sales_round_robin_pointer_state_write_managers",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "private.can_manage_round_robin()",
    "with_check": "private.can_manage_round_robin()"
  },
  {
    "schemaname": "public",
    "tablename": "sales_round_robin_pool",
    "policyname": "sales_round_robin_pool_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "sales_round_robin_pool",
    "policyname": "sales_round_robin_pool_write_managers",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "private.can_manage_round_robin()",
    "with_check": "private.can_manage_round_robin()"
  },
  {
    "schemaname": "public",
    "tablename": "sales_round_robin_state",
    "policyname": "sales_round_robin_state_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "sales_round_robin_state",
    "policyname": "sales_round_robin_state_write_managers",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "private.can_manage_round_robin()",
    "with_check": "private.can_manage_round_robin()"
  },
  {
    "schemaname": "public",
    "tablename": "shipper_shipment_items",
    "policyname": "shipper_shipment_items_select_permitted",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.can_access_shipment(shipment_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "shipper_shipment_items",
    "policyname": "shipper_shipment_items_write_staff",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "private.is_shipment_staff()",
    "with_check": "private.is_shipment_staff()"
  },
  {
    "schemaname": "public",
    "tablename": "shipper_shipments",
    "policyname": "shipper_shipments_select_permitted",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.can_access_shipper(shipper_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "shipper_shipments",
    "policyname": "shipper_shipments_update_own_shipper",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "(shipper_id = private.current_shipper_id())",
    "with_check": "(shipper_id = private.current_shipper_id())"
  },
  {
    "schemaname": "public",
    "tablename": "shipper_shipments",
    "policyname": "shipper_shipments_write_staff",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "private.is_shipment_staff()",
    "with_check": "private.is_shipment_staff()"
  },
  {
    "schemaname": "public",
    "tablename": "shipper_spreadsheet_rows",
    "policyname": "shipper_spreadsheet_rows_realtime_select",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(EXISTS ( SELECT 1\n   FROM (shipper_workbooks workbook\n     JOIN profiles profile ON ((profile.id = auth.uid())))\n  WHERE ((workbook.id = shipper_spreadsheet_rows.workbook_id) AND ((lower(COALESCE(profile.role, ''::text)) = ANY (ARRAY['pm'::text, 'admin'::text, 'director'::text, 'dev'::text])) OR ((lower(COALESCE(profile.role, ''::text)) = 'shipper'::text) AND (profile.shipper_id = workbook.shipper_id))))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "shipper_staging_rows",
    "policyname": "shipper_staging_rows_staff_only",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "private.is_shipment_staff()",
    "with_check": "private.is_shipment_staff()"
  },
  {
    "schemaname": "public",
    "tablename": "shipper_view_rows",
    "policyname": "shipper_view_rows_staff_only",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "private.is_shipment_staff()",
    "with_check": "private.is_shipment_staff()"
  },
  {
    "schemaname": "public",
    "tablename": "shipper_workbooks",
    "policyname": "shipper_workbooks_realtime_select",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(EXISTS ( SELECT 1\n   FROM profiles profile\n  WHERE ((profile.id = auth.uid()) AND ((lower(COALESCE(profile.role, ''::text)) = ANY (ARRAY['pm'::text, 'admin'::text, 'director'::text, 'dev'::text])) OR ((lower(COALESCE(profile.role, ''::text)) = 'shipper'::text) AND (profile.shipper_id = shipper_workbooks.shipper_id))))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "shippers",
    "policyname": "shippers_select_permitted",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.can_access_shipper(id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "shippers",
    "policyname": "shippers_write_configuration_manager",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "private.is_configuration_manager()",
    "with_check": "private.is_configuration_manager()"
  },
  {
    "schemaname": "public",
    "tablename": "subitem_assignees",
    "policyname": "crm_admin_delete_subitem_assignees",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "current_user_is_crm_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "subitem_assignees",
    "policyname": "crm_admin_insert_subitem_assignees",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "current_user_is_crm_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "subitem_assignees",
    "policyname": "crm_admin_update_subitem_assignees",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "current_user_is_crm_admin()",
    "with_check": "current_user_is_crm_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "subitem_assignees",
    "policyname": "directors_manage_subitem_assignments",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "(EXISTS ( SELECT 1\n   FROM profiles profile\n  WHERE ((profile.id = auth.uid()) AND (lower(COALESCE(profile.role, ''::text)) = 'director'::text))))",
    "with_check": "(EXISTS ( SELECT 1\n   FROM profiles profile\n  WHERE ((profile.id = auth.uid()) AND (lower(COALESCE(profile.role, ''::text)) = 'director'::text))))"
  },
  {
    "schemaname": "public",
    "tablename": "subitem_assignees",
    "policyname": "subitem_assignees_delete_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "subitem_assignees",
    "policyname": "subitem_assignees_insert_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(private.is_internal_user() AND private.is_internal_profile(user_id))"
  },
  {
    "schemaname": "public",
    "tablename": "subitem_assignees",
    "policyname": "subitem_assignees_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "subitem_payment_rows",
    "policyname": "Authenticated users can manage subitem payment rows",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "true",
    "with_check": "true"
  },
  {
    "schemaname": "public",
    "tablename": "subitem_payment_rows",
    "policyname": "Authenticated users can read subitem payment rows",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "subitems",
    "policyname": "crm_admin_insert_subitems",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "current_user_is_crm_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "subitems",
    "policyname": "crm_admin_update_subitems",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "current_user_is_crm_admin()",
    "with_check": "current_user_is_crm_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "subitems",
    "policyname": "directors_manage_all_subitems",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "(EXISTS ( SELECT 1\n   FROM profiles profile\n  WHERE ((profile.id = auth.uid()) AND (lower(COALESCE(profile.role, ''::text)) = 'director'::text))))",
    "with_check": "(EXISTS ( SELECT 1\n   FROM profiles profile\n  WHERE ((profile.id = auth.uid()) AND (lower(COALESCE(profile.role, ''::text)) = 'director'::text))))"
  },
  {
    "schemaname": "public",
    "tablename": "subitems",
    "policyname": "subitems_delete_permitted",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "private.can_delete_crm_row(created_at, deletion_owner_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "subitems",
    "policyname": "subitems_insert_client_assigned",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "private.can_edit_client(client_id)"
  },
  {
    "schemaname": "public",
    "tablename": "subitems",
    "policyname": "subitems_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "private.is_internal_user()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "subitems",
    "policyname": "subitems_update_assigned",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "private.can_edit_subitem(id, client_id)",
    "with_check": "private.can_edit_subitem(id, client_id)"
  },
  {
    "schemaname": "public",
    "tablename": "user_settings",
    "policyname": "user_settings_delete_own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "(( SELECT auth.uid() AS uid) = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "user_settings",
    "policyname": "user_settings_insert_own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(( SELECT auth.uid() AS uid) = user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "user_settings",
    "policyname": "user_settings_select_own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(( SELECT auth.uid() AS uid) = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "user_settings",
    "policyname": "user_settings_update_own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "(( SELECT auth.uid() AS uid) = user_id)",
    "with_check": "(( SELECT auth.uid() AS uid) = user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "user_table_prefs",
    "policyname": "user_table_prefs_own",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "(( SELECT auth.uid() AS uid) = user_id)",
    "with_check": "(( SELECT auth.uid() AS uid) = user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "working_calendar_days",
    "policyname": "working_calendar_days_manage",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "can_manage_working_calendar()",
    "with_check": "can_manage_working_calendar()"
  },
  {
    "schemaname": "public",
    "tablename": "working_calendar_days",
    "policyname": "working_calendar_days_read",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "true",
    "with_check": null
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "crm_files_insert_assigned",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "((bucket_id = 'crm-files'::text) AND private.can_upload_crm_file(name))"
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "crm_files_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((bucket_id = 'crm-files'::text) AND private.is_internal_user())",
    "with_check": null
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "order_confirmation_files_insert_assigned",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "((bucket_id = 'order-confirmation-files'::text) AND private.can_upload_ocf_item_image(name))"
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "order_confirmation_files_select_internal",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((bucket_id = 'order-confirmation-files'::text) AND private.is_internal_user())",
    "with_check": null
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "shipper_attachments_delete_permitted",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "((bucket_id = 'shipper-attachments'::text) AND (split_part(name, '/'::text, 1) ~* '^[0-9a-f-]{36}$'::text) AND private.can_access_shipper((split_part(name, '/'::text, 1))::uuid))",
    "with_check": null
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "shipper_attachments_insert_permitted",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "((bucket_id = 'shipper-attachments'::text) AND (split_part(name, '/'::text, 1) ~* '^[0-9a-f-]{36}$'::text) AND private.can_access_shipper((split_part(name, '/'::text, 1))::uuid))"
  },
  {
    "schemaname": "storage",
    "tablename": "objects",
    "policyname": "shipper_attachments_select_permitted",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((bucket_id = 'shipper-attachments'::text) AND (split_part(name, '/'::text, 1) ~* '^[0-9a-f-]{36}$'::text) AND private.can_access_shipper((split_part(name, '/'::text, 1))::uuid))",
    "with_check": null
  }
]

9.
[
  {
    "schema_name": "auth",
    "table_name": "users",
    "trigger_name": "on_auth_user_created",
    "event_manipulation": "INSERT",
    "action_timing": "AFTER",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION handle_new_user()"
  },
  {
    "schema_name": "public",
    "table_name": "client_assignees",
    "trigger_name": "client_assignees_set_system_deletion_owner",
    "event_manipulation": "INSERT",
    "action_timing": "AFTER",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION set_system_client_deletion_owner()"
  },
  {
    "schema_name": "public",
    "table_name": "clients",
    "trigger_name": "clients_set_creator_fields",
    "event_manipulation": "INSERT",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION set_crm_creator_fields()"
  },
  {
    "schema_name": "public",
    "table_name": "clients",
    "trigger_name": "clients_set_creator_fields",
    "event_manipulation": "UPDATE",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION set_crm_creator_fields()"
  },
  {
    "schema_name": "public",
    "table_name": "estimate_generations",
    "trigger_name": "refresh_tracking_client_totals_quote",
    "event_manipulation": "DELETE",
    "action_timing": "AFTER",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION refresh_tracking_client_totals_from_quote()"
  },
  {
    "schema_name": "public",
    "table_name": "estimate_generations",
    "trigger_name": "refresh_tracking_client_totals_quote",
    "event_manipulation": "INSERT",
    "action_timing": "AFTER",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION refresh_tracking_client_totals_from_quote()"
  },
  {
    "schema_name": "public",
    "table_name": "estimate_generations",
    "trigger_name": "refresh_tracking_client_totals_quote",
    "event_manipulation": "UPDATE",
    "action_timing": "AFTER",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION refresh_tracking_client_totals_from_quote()"
  },
  {
    "schema_name": "public",
    "table_name": "option_values",
    "trigger_name": "prevent_system_label_deletion",
    "event_manipulation": "DELETE",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION prevent_system_label_deletion()"
  },
  {
    "schema_name": "public",
    "table_name": "quickbooks_estimate_invoices",
    "trigger_name": "quickbooks_estimate_invoices_set_updated_at",
    "event_manipulation": "UPDATE",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION set_quickbooks_estimate_invoice_updated_at()"
  },
  {
    "schema_name": "public",
    "table_name": "quickbooks_estimate_invoices",
    "trigger_name": "refresh_tracking_client_totals_invoice",
    "event_manipulation": "DELETE",
    "action_timing": "AFTER",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION refresh_tracking_client_totals_from_invoice()"
  },
  {
    "schema_name": "public",
    "table_name": "quickbooks_estimate_invoices",
    "trigger_name": "refresh_tracking_client_totals_invoice",
    "event_manipulation": "INSERT",
    "action_timing": "AFTER",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION refresh_tracking_client_totals_from_invoice()"
  },
  {
    "schema_name": "public",
    "table_name": "quickbooks_estimate_invoices",
    "trigger_name": "refresh_tracking_client_totals_invoice",
    "event_manipulation": "UPDATE",
    "action_timing": "AFTER",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION refresh_tracking_client_totals_from_invoice()"
  },
  {
    "schema_name": "public",
    "table_name": "shipper_shipment_items",
    "trigger_name": "shipper_shipment_items_guard_shipper_columns",
    "event_manipulation": "UPDATE",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION private.guard_shipper_shipment_columns()"
  },
  {
    "schema_name": "public",
    "table_name": "shipper_shipments",
    "trigger_name": "shipper_shipments_guard_shipper_columns",
    "event_manipulation": "UPDATE",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION private.guard_shipper_shipment_columns()"
  },
  {
    "schema_name": "public",
    "table_name": "shipper_spreadsheet_rows",
    "trigger_name": "shipper_spreadsheet_rows_set_updated_at",
    "event_manipulation": "UPDATE",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION set_shipper_spreadsheet_updated_at()"
  },
  {
    "schema_name": "public",
    "table_name": "shipper_workbooks",
    "trigger_name": "shipper_workbooks_set_updated_at",
    "event_manipulation": "UPDATE",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION set_shipper_spreadsheet_updated_at()"
  },
  {
    "schema_name": "public",
    "table_name": "subitem_assignees",
    "trigger_name": "subitem_assignees_set_system_deletion_owner",
    "event_manipulation": "INSERT",
    "action_timing": "AFTER",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION set_system_subitem_deletion_owner()"
  },
  {
    "schema_name": "public",
    "table_name": "subitems",
    "trigger_name": "prevent_locked_client_subitem_updates",
    "event_manipulation": "UPDATE",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION prevent_locked_client_subitem_updates()"
  },
  {
    "schema_name": "public",
    "table_name": "subitems",
    "trigger_name": "refresh_tracking_client_totals_subitem",
    "event_manipulation": "DELETE",
    "action_timing": "AFTER",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION refresh_tracking_client_totals_from_subitem()"
  },
  {
    "schema_name": "public",
    "table_name": "subitems",
    "trigger_name": "refresh_tracking_client_totals_subitem",
    "event_manipulation": "INSERT",
    "action_timing": "AFTER",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION refresh_tracking_client_totals_from_subitem()"
  },
  {
    "schema_name": "public",
    "table_name": "subitems",
    "trigger_name": "refresh_tracking_client_totals_subitem",
    "event_manipulation": "UPDATE",
    "action_timing": "AFTER",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION refresh_tracking_client_totals_from_subitem()"
  },
  {
    "schema_name": "public",
    "table_name": "subitems",
    "trigger_name": "subitems_set_creator_fields",
    "event_manipulation": "INSERT",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION set_crm_creator_fields()"
  },
  {
    "schema_name": "public",
    "table_name": "subitems",
    "trigger_name": "subitems_set_creator_fields",
    "event_manipulation": "UPDATE",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION set_crm_creator_fields()"
  },
  {
    "schema_name": "public",
    "table_name": "subitems",
    "trigger_name": "subitems_update_client_progress_on_timeline_delivery",
    "event_manipulation": "INSERT",
    "action_timing": "AFTER",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION update_client_progress_when_timelines_delivered()"
  },
  {
    "schema_name": "public",
    "table_name": "subitems",
    "trigger_name": "subitems_update_client_progress_on_timeline_delivery",
    "event_manipulation": "UPDATE",
    "action_timing": "AFTER",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION update_client_progress_when_timelines_delivered()"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "trigger_name": "enforce_bucket_name_length_trigger",
    "event_manipulation": "INSERT",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION storage.enforce_bucket_name_length()"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "trigger_name": "enforce_bucket_name_length_trigger",
    "event_manipulation": "UPDATE",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION storage.enforce_bucket_name_length()"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "trigger_name": "protect_bucket_control_insert",
    "event_manipulation": "INSERT",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION storage.protect_bucket_control_columns('service_role')"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "trigger_name": "protect_bucket_control_update",
    "event_manipulation": "UPDATE",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION storage.protect_bucket_control_columns()"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "trigger_name": "protect_bucket_control_update_role",
    "event_manipulation": "UPDATE",
    "action_timing": "AFTER",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role('service_role')"
  },
  {
    "schema_name": "storage",
    "table_name": "buckets",
    "trigger_name": "protect_buckets_delete",
    "event_manipulation": "DELETE",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION storage.protect_delete()"
  },
  {
    "schema_name": "storage",
    "table_name": "objects",
    "trigger_name": "protect_objects_delete",
    "event_manipulation": "DELETE",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION storage.protect_delete()"
  },
  {
    "schema_name": "storage",
    "table_name": "objects",
    "trigger_name": "update_objects_updated_at",
    "event_manipulation": "UPDATE",
    "action_timing": "BEFORE",
    "action_condition": null,
    "action_statement": "EXECUTE FUNCTION storage.update_updated_at_column()"
  }
]

10.
[
  {
    "publication_name": "supabase_realtime",
    "schemaname": "public",
    "tablename": "activity_log",
    "attnames": "{id,client_id,subitem_id,actor_name,action,field_name,old_value,new_value,subitem_name,created_at,title,link,description,meta}",
    "rowfilter": null
  },
  {
    "publication_name": "supabase_realtime",
    "schemaname": "public",
    "tablename": "client_assignees",
    "attnames": "{client_id,user_id,assigned_at,assigned_by,assignment_type}",
    "rowfilter": null
  },
  {
    "publication_name": "supabase_realtime",
    "schemaname": "public",
    "tablename": "clients",
    "attnames": "{id,name,people,reply_status,follow_up,status,channel,importance,company,email,phone,requirements,nbd,total_price,billing_address,expanded,color,activity_log,group_id,status_option_id,reply_status_option_id,channel_option_id,importance_option_id,custom_fields,created_at,waiting_started_at,progress,created_by,deletion_owner_id,progress_option_id,unqualified_reason,deleted_at,deleted_by,display_id,tracking_overall_price_invoice_match,tracking_overall_price_invoice_match_option_id,tracking_overall_invoice_payment_status,tracking_overall_invoice_payment_status_option_id,tracking_total_price,tracking_quote_subtotal,tracking_quote_total,tracking_invoice_subtotal,tracking_invoice_total,tracking_invoice_numbers}",
    "rowfilter": null
  },
  {
    "publication_name": "supabase_realtime",
    "schemaname": "public",
    "tablename": "crm_groups",
    "attnames": "{id,name,color,sort_order,created_by,created_at}",
    "rowfilter": null
  },
  {
    "publication_name": "supabase_realtime",
    "schemaname": "public",
    "tablename": "custom_columns",
    "attnames": "{id,name,target,field_type,sort_order,created_at}",
    "rowfilter": null
  },
  {
    "publication_name": "supabase_realtime",
    "schemaname": "public",
    "tablename": "notifications",
    "attnames": "{id,user_id,client_id,type,message,read,dedupe_key,created_at}",
    "rowfilter": null
  },
  {
    "publication_name": "supabase_realtime",
    "schemaname": "public",
    "tablename": "option_groups",
    "attnames": "{id,code,label,created_at}",
    "rowfilter": null
  },
  {
    "publication_name": "supabase_realtime",
    "schemaname": "public",
    "tablename": "option_values",
    "attnames": "{id,group_id,value,color,sort_order,is_active,created_at,system_key,section_index}",
    "rowfilter": null
  },
  {
    "publication_name": "supabase_realtime",
    "schemaname": "public",
    "tablename": "order_confirmations",
    "attnames": "{id,client_id,generated_by,generated_at,client_name_snapshot,company_snapshot,salesperson_ids,salesperson_name,salesperson_email,salesperson_contact_number,estimated_delivery_date,important_notes,status,client_token,client_signed_at,client_submitted_at,client_ip,client_signature_path,locked_at,estimated_delivery_notes,same_address_for_all_items,remarks_for_delivery,client_email_snapshot,strict_need_by_warning,strict_need_by_date,terms_read,terms_agreed,artwork_confirmed_item_ids}",
    "rowfilter": null
  },
  {
    "publication_name": "supabase_realtime",
    "schemaname": "public",
    "tablename": "profiles",
    "attnames": "{id,email,full_name,avatar_url,created_at,updated_at,contact_number,role,shipper_id}",
    "rowfilter": null
  },
  {
    "publication_name": "supabase_realtime",
    "schemaname": "public",
    "tablename": "sales_round_robin_pool",
    "attnames": "{id,user_id,position,is_active,created_at,list_name}",
    "rowfilter": null
  },
  {
    "publication_name": "supabase_realtime",
    "schemaname": "public",
    "tablename": "sales_round_robin_state",
    "attnames": "{id,current_position,updated_at}",
    "rowfilter": null
  },
  {
    "publication_name": "supabase_realtime",
    "schemaname": "public",
    "tablename": "shipper_spreadsheet_rows",
    "attnames": "{id,workbook_id,row_type,source_type,source_subitem_id,shipment_group_id,planned_for,sort_key,is_locked,values,version,created_by,created_at,updated_at,cell_fills,auto_lock_at}",
    "rowfilter": null
  },
  {
    "publication_name": "supabase_realtime",
    "schemaname": "public",
    "tablename": "subitem_assignees",
    "attnames": "{subitem_id,user_id,assigned_at,assigned_by}",
    "rowfilter": null
  },
  {
    "publication_name": "supabase_realtime",
    "schemaname": "public",
    "tablename": "subitems",
    "attnames": "{id,client_id,name,people,status,qty,description,remarks,shipper,supplier,cost,ls,os,tc,uc,tc_sgd,price,up,owner,payment_status,manpower,ls_rmb,total_c,mode_of_payment,order_number,quantity_produced,sample,qty_for,payment_amount,difference,local_overseas,num_of_cartons,payment_remarks,cn_tracking,sg_tracking,sample_order_status,sample_status,sample_type,timeline_rows,show_timeline,show_payments,sample_rows,show_sample,shipper_id,pl,sl,currency,c_sgd,manpower_rmb,total_uc,custom_fields,payment,created_at,position,created_by,deletion_owner_id,status_option_id,shipper_option_id,currency_option_id,payment_option_id,payment_status_option_id,mode_of_payment_option_id,local_overseas_option_id,deleted_at,deleted_by,deleted_with_client_id,qty_free,qty_total,qty_we_keep,timeline_groups,display_id,supplier_profile_id}",
    "rowfilter": null
  }
]

11.
[
  {
    "bucket_id": "crm-files",
    "bucket_name": "crm-files",
    "public": false,
    "file_size_limit": 26214400,
    "allowed_mime_types": null,
    "object_count": 150,
    "object_bytes": 40100136,
    "object_size": "38 MB"
  },
  {
    "bucket_id": "order-confirmation-files",
    "bucket_name": "order-confirmation-files",
    "public": false,
    "file_size_limit": null,
    "allowed_mime_types": null,
    "object_count": 110,
    "object_bytes": 9877274,
    "object_size": "9646 kB"
  },
  {
    "bucket_id": "shipper-attachments",
    "bucket_name": "shipper-attachments",
    "public": false,
    "file_size_limit": null,
    "allowed_mime_types": null,
    "object_count": 10,
    "object_bytes": 1539661,
    "object_size": "1504 kB"
  }
]

12.
[
  {
    "bucket_id": "crm-files",
    "top_level_prefix": "clients",
    "object_count": 56,
    "object_bytes": 21298584
  },
  {
    "bucket_id": "crm-files",
    "top_level_prefix": "quickbooks-bills-only",
    "object_count": 39,
    "object_bytes": 8611812
  },
  {
    "bucket_id": "crm-files",
    "top_level_prefix": "legacy-migration",
    "object_count": 20,
    "object_bytes": 3517951
  },
  {
    "bucket_id": "crm-files",
    "top_level_prefix": "email-review",
    "object_count": 16,
    "object_bytes": 3440085
  },
  {
    "bucket_id": "crm-files",
    "top_level_prefix": "subitems",
    "object_count": 16,
    "object_bytes": 2715463
  },
  {
    "bucket_id": "crm-files",
    "top_level_prefix": "sample-estimates",
    "object_count": 3,
    "object_bytes": 516241
  },
  {
    "bucket_id": "order-confirmation-files",
    "top_level_prefix": "ocf-items",
    "object_count": 82,
    "object_bytes": 9608899
  },
  {
    "bucket_id": "order-confirmation-files",
    "top_level_prefix": "ocf-signatures",
    "object_count": 28,
    "object_bytes": 268375
  },
  {
    "bucket_id": "shipper-attachments",
    "top_level_prefix": "61d1c7d6-3a99-412e-872a-c1e1c21193a1",
    "object_count": 10,
    "object_bytes": 1539661
  }
]

13.
[
  {
    "auth_user_count": 13
  }
]

14.
[
  {
    "datname": "postgres",
    "usename": "authenticator",
    "application_name": "PostgREST 14.18",
    "state": "idle",
    "connection_count": 1
  },
  {
    "datname": "postgres",
    "usename": "pgbouncer",
    "application_name": "",
    "state": "idle",
    "connection_count": 1
  },
  {
    "datname": "postgres",
    "usename": "postgres",
    "application_name": "pg_net 0.20.4",
    "state": "idle",
    "connection_count": 1
  },
  {
    "datname": "postgres",
    "usename": "postgres",
    "application_name": "supabase/dashboard-query-editor",
    "state": "active",
    "connection_count": 1
  },
  {
    "datname": "postgres",
    "usename": "supabase_admin",
    "application_name": "pg_cron scheduler",
    "state": null,
    "connection_count": 1
  },
  {
    "datname": "postgres",
    "usename": "supabase_admin",
    "application_name": "postgres_exporter",
    "state": "idle",
    "connection_count": 1
  }
]