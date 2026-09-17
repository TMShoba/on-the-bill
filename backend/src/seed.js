import bcrypt from "bcryptjs";
import { one, query } from "./db.js";

const DEMO_ARTIST_USER_ID = "demo-artist-user-001";
const DEMO_PROMOTER_USER_ID = "demo-promoter-user-001";
const DEMO_CATALOG_ARTIST_ID = "2";
const DEMO_PASSWORD = "Demo1234!";

const artists = [
  { id: "1", stage_name: "Tyla", genre: "Pop / Amapiano", location: "Johannesburg", rate: 45000, image_url: "/artists/tyla.webp", bio: "Global pop and Amapiano star." },
  { id: "2", stage_name: "DJ Maphorisa", genre: "Amapiano", location: "Johannesburg", rate: 15000, image_url: "/artists/maphorisa.webp", bio: "Top Amapiano producer and hitmaker." },
  { id: "3", stage_name: "Master KG", genre: "Amapiano / Afro Pop", location: "Limpopo", rate: 30000, image_url: "/artists/master-kg.webp", bio: "Global sensation known for Jerusalema." },
  { id: "4", stage_name: "Kabza De Small", genre: "Amapiano", location: "Pretoria", rate: 18000, image_url: "/artists/kabza.webp", bio: "The King of Amapiano." },
  { id: "5", stage_name: "Nomcebo Zikode", genre: "Afro Pop / Gospel", location: "Johannesburg", rate: 20000, image_url: "/artists/nomcebo.webp", bio: "Vocalist behind major international hits." },
  { id: "6", stage_name: "Shimza", genre: "House / Electronic", location: "Johannesburg", rate: 25000, image_url: "/artists/shimza.webp", bio: "Electronic and house heavyweight." },
  { id: "7", stage_name: "Black Coffee", genre: "Afro House", location: "Durban", rate: 50000, image_url: "/artists/black-coffee.webp", bio: "Grammy-winning house DJ and producer." },
  { id: "8", stage_name: "Tyler ICU", genre: "Amapiano", location: "Johannesburg", rate: 16000, image_url: "/artists/tyler-icu.webp", bio: "Chart-topping Amapiano producer." },
  { id: "9", stage_name: "Nasty C", genre: "Hip Hop", location: "Durban", rate: 30000, image_url: "/artists/nasty-c.webp", bio: "Leading SA hip-hop export." },
  { id: "10", stage_name: "Focalistic", genre: "Amapiano", location: "Pretoria", rate: 18000, image_url: "/artists/focalistic.webp", bio: "Amapiano star with street appeal." },
  { id: "11", stage_name: "Uncle Waffles", genre: "Amapiano", location: "Johannesburg", rate: 22000, image_url: "/artists/uncle-waffles.webp", bio: "High-energy Amapiano DJ." },
  { id: "12", stage_name: "Kelvin Momo", genre: "Private School Piano", location: "Johannesburg", rate: 15000, image_url: "/artists/kelvin-momo.webp", bio: "Private School Piano pioneer." },
  { id: "13", stage_name: "Boohle", genre: "Amapiano", location: "Johannesburg", rate: 14000, image_url: "/artists/boohle.webp", bio: "Distinctive Amapiano vocalist." },
  { id: "14", stage_name: "Mellow & Sleazy", genre: "Amapiano", location: "Pretoria", rate: 16000, image_url: "/artists/mellow-sleazy.webp", bio: "Hit-making producer duo." },
  { id: "15", stage_name: "Kamo Mphela", genre: "Amapiano", location: "Johannesburg", rate: 15000, image_url: "/artists/kamo-mphela.webp", bio: "Dance and vocal force." },
  { id: "16", stage_name: "Daliwonga", genre: "Amapiano", location: "Johannesburg", rate: 14000, image_url: "/artists/daliwonga.webp", bio: "Melodic Amapiano vocalist." },
  { id: "17", stage_name: "Ami Faku", genre: "Afro Pop / Soul", location: "Port Elizabeth", rate: 18000, image_url: "/artists/ami-faku.webp", bio: "Soulful vocalist and songwriter." },
  { id: "18", stage_name: "Nkosazana Daughter", genre: "Amapiano", location: "Johannesburg", rate: 14000, image_url: "/artists/nkosazana.webp", bio: "Sought-after Amapiano vocalist." },
  { id: "19", stage_name: "Blxckie", genre: "Hip Hop", location: "Durban", rate: 14000, image_url: "/artists/blxckie.webp", bio: "Modern hip-hop and trap star." },
  { id: "20", stage_name: "Musa Keys", genre: "Amapiano", location: "Johannesburg", rate: 16000, image_url: "/artists/musa-keys.webp", bio: "Amapiano star with cross-border appeal." },
  { id: "21", stage_name: "A-Reece", genre: "Hip Hop", location: "Pretoria", rate: 25000, image_url: "/artists/areece.webp", bio: "Respected SA lyricist." },
  { id: "22", stage_name: "Dlala Thukzin", genre: "Gqom", location: "Durban", rate: 20000, image_url: "/artists/dlala-thukzin.webp", bio: "High-energy Gqom producer." },
  { id: "23", stage_name: "DBN Gogo", genre: "Amapiano", location: "Durban", rate: 20000, image_url: "/artists/dbn-gogo.webp", bio: "Recognized Amapiano DJ." },
  { id: "24", stage_name: "Oscar Mbo", genre: "House", location: "Johannesburg", rate: 18000, image_url: "/artists/oscar-mbo.webp", bio: "Deep house DJ and producer." },
  { id: "25", stage_name: "Cassper Nyovest", genre: "Hip Hop", location: "Mahikeng / Johannesburg", rate: 35000, image_url: "/artists/cassper.webp", bio: "Multi-platinum hip-hop heavyweight." },
];

function isoOffset(days, time = "21:00") {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return { date: `${y}-${m}-${day}`, time };
}

export async function seedAll() {
  const countRow = await one("SELECT COUNT(*)::int AS c FROM artists");
  if ((countRow?.c ?? 0) === 0) {
    for (const a of artists) {
      await query(
        `INSERT INTO artists (id, stage_name, genre, location, rate, image_url, bio)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [a.id, a.stage_name, a.genre, a.location, a.rate, a.image_url, a.bio]
      );
    }
    console.log(`Seed: artists inserted (${artists.length})`);
  } else {
    await query(
      `INSERT INTO artists (id, stage_name, genre, location, rate, image_url, bio)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET stage_name = EXCLUDED.stage_name`,
      [
        artists[1].id,
        artists[1].stage_name,
        artists[1].genre,
        artists[1].location,
        artists[1].rate,
        artists[1].image_url,
        artists[1].bio,
      ]
    );
    console.log(`Seed: artists already present (${countRow.c}) — kept`);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  async function upsertUser({ id, name, email, role, artistId }) {
    const existing = await one(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );
    if (existing) {
      await query(
        `UPDATE users SET name = $1, password = $2, role = $3, artist_id = $4
         WHERE id = $5`,
        [name, passwordHash, role, artistId, existing.id]
      );
    } else {
      await query(
        `INSERT INTO users (id, name, email, password, role, artist_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [id, name, email, passwordHash, role, artistId]
      );
    }
  }

  await upsertUser({
    id: DEMO_ARTIST_USER_ID,
    name: "DJ Maphorisa",
    email: "artist@thelineup.co.za",
    role: "artist",
    artistId: DEMO_CATALOG_ARTIST_ID,
  });
  await upsertUser({
    id: DEMO_PROMOTER_USER_ID,
    name: "Thabo Events",
    email: "promoter@thelineup.co.za",
    role: "client",
    artistId: null,
  });

  console.log("Seed: demo users ready (artist@ / promoter@  password Demo1234!)");

  const g1 = isoOffset(3);
  const g2 = isoOffset(8);
  const g3 = isoOffset(-5);
  const g4 = isoOffset(1);

  const samples = [
    {
      id: "demo-booking-pending-1",
      status: "pending",
      payment: "unpaid",
      venue: "Sandton Convention Centre",
      city: "Sandton",
      address: "161 Maude St",
      date: g1.date,
      time: g1.time,
      fee: 15000,
      message: "Amapiano night — 2 hour set.",
      promoter_id: DEMO_PROMOTER_USER_ID,
      client: "Thabo Events",
      email: "promoter@thelineup.co.za",
    },
    {
      id: "demo-booking-confirmed-1",
      status: "confirmed",
      payment: "unpaid",
      venue: "The Orbit, Braamfontein",
      city: "Johannesburg",
      address: "81 De Korte St",
      date: g2.date,
      time: g2.time,
      fee: 18000,
      message: "Club residency slot.",
      promoter_id: DEMO_PROMOTER_USER_ID,
      client: "Thabo Events",
      email: "promoter@thelineup.co.za",
    },
    {
      id: "demo-booking-paid-1",
      status: "confirmed",
      payment: "paid",
      venue: "Joburg Theatre Outdoor",
      city: "Johannesburg",
      address: "Loveday St",
      date: g3.date,
      time: "20:00",
      fee: 20000,
      message: "Festival side stage — completed.",
      promoter_id: DEMO_PROMOTER_USER_ID,
      client: "Thabo Events",
      email: "promoter@thelineup.co.za",
    },
    {
      id: "demo-booking-pending-other",
      status: "pending",
      payment: "unpaid",
      venue: "Arcade Empire",
      city: "Cape Town",
      address: "Long St",
      date: g4.date,
      time: g4.time,
      fee: 16000,
      message: "New request from another promoter.",
      promoter_id: null,
      client: "Cape Town Live",
      email: "bookings@capetownlive.co.za",
    },
  ];

  for (const b of samples) {
    await query(
      `INSERT INTO bookings (
        id, artist_id, artist_name, client_name, client_email, event_date,
        venue, message, status, created_at, address, city, time, fee,
        promoter_name, promoter_id, notes, reminder_opt_in, payment_status, paid_at
      ) VALUES (
        $1,$2,'DJ Maphorisa',$3,$4,$5,
        $6,$7,$8,NOW(),$9,$10,$11,$12,
        $3,$13,'',$14,$15,
        CASE WHEN $15 = 'paid' THEN NOW() ELSE NULL END
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        payment_status = EXCLUDED.payment_status,
        fee = EXCLUDED.fee,
        event_date = EXCLUDED.event_date`,
      [
        b.id,
        DEMO_CATALOG_ARTIST_ID,
        b.client,
        b.email,
        b.date,
        b.venue,
        b.message,
        b.status,
        b.address,
        b.city,
        b.time,
        b.fee,
        b.promoter_id,
        true,
        b.payment,
      ]
    );
  }
  console.log(`Seed: ${samples.length} sample bookings linked to DJ Maphorisa (id 2)`);

  const u = await one("SELECT COUNT(*)::int AS c FROM users");
  const bk = await one("SELECT COUNT(*)::int AS c FROM bookings");
  const a = await one("SELECT COUNT(*)::int AS c FROM artists");
  console.log(
    `Seed complete. Artists: ${a?.c}, Users: ${u?.c}, Bookings: ${bk?.c}`
  );
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("seed.js") || process.argv[1].includes("seed"));

if (isMain) {
  const { migrate } = await import("./db.js");
  await migrate();
  await seedAll();
  process.exit(0);
}
