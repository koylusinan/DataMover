import pg from 'pg';

const { Pool } = pg;

// Connect to the source PostgreSQL (not Supabase)
const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  database: 'testdb',
  user: 'postgres',
  password: 'postgres',
  ssl: false,
});

async function checkActualWAL() {
  try {
    console.log('📊 PostgreSQL WAL Ayarları ve Mevcut Durum:\n');

    // 1. Get PostgreSQL's max_wal_size configuration
    const configResult = await pool.query(`
      SELECT name, setting, unit, short_desc
      FROM pg_settings
      WHERE name IN ('max_wal_size', 'min_wal_size', 'wal_keep_size')
    `);

    console.log('🔧 PostgreSQL WAL Konfigürasyonu:');
    configResult.rows.forEach(row => {
      const value = row.unit === 'MB' ? `${row.setting} MB` : row.setting;
      console.log(`  ${row.name}: ${value}`);
      console.log(`    → ${row.short_desc}\n`);
    });

    // 2. Get replication slot info
    const slotResult = await pool.query(`
      SELECT
        slot_name,
        active,
        restart_lsn,
        confirmed_flush_lsn,
        COALESCE(
          pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) / (1024 * 1024),
          0
        ) as wal_size_mb,
        COALESCE(
          pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn),
          0
        ) as lag_bytes
      FROM pg_replication_slots
      WHERE slot_name = 'denizim_slot_restore'
    `);

    if (slotResult.rows.length > 0) {
      const slot = slotResult.rows[0];
      console.log('📍 Replication Slot Durumu:');
      console.log(`  Slot Name: ${slot.slot_name}`);
      console.log(`  Active: ${slot.active ? '✅ Evet' : '❌ Hayır'}`);
      console.log(`  WAL Size: ${parseFloat(slot.wal_size_mb).toFixed(2)} MB`);
      console.log(`  Lag: ${(slot.lag_bytes / 1024).toFixed(2)} KB (${slot.lag_bytes} bytes)`);
      console.log(`  Restart LSN: ${slot.restart_lsn}`);
      console.log(`  Confirmed Flush LSN: ${slot.confirmed_flush_lsn}\n`);
    }

    // 3. Get WAL directory size
    const walDirResult = await pool.query(`
      SELECT
        pg_size_pretty(sum((pg_stat_file('pg_wal/' || name)).size)) as total_wal_size,
        count(*) as wal_file_count
      FROM pg_ls_waldir()
    `);

    if (walDirResult.rows.length > 0) {
      console.log('📁 WAL Dizini:');
      console.log(`  Toplam WAL Boyutu: ${walDirResult.rows[0].total_wal_size}`);
      console.log(`  WAL Dosya Sayısı: ${walDirResult.rows[0].wal_file_count}\n`);
    }

    // 4. Get current WAL location
    const walLocation = await pool.query(`
      SELECT pg_current_wal_lsn() as current_lsn
    `);

    console.log('📌 Mevcut WAL Konumu:');
    console.log(`  Current LSN: ${walLocation.rows[0].current_lsn}\n`);

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkActualWAL();
