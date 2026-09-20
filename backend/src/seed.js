import bcrypt from "bcryptjs";
import db, { migrate } from "./db.js";

async function seed() {
  await migrate();


/**
 * Safe seed: artists if empty, demo users + sample bookings always upserted.
 * Demo accounts (password same for both):
 *   Artist:   artist@thelineup.co.za   / Demo1234!
 *   Promoter: promoter@thelineup.co.za / Demo1234!
 * Artist is linked to catalog id "2" (DJ Maphorisa) so bookings match the listing.
 */

const artists = [
  { id: "1", stage_name: "Tyla", genre: "Pop / Amapiano", location: "Johannesburg", rate: 45000, image_url: "/artists/tyla.webp", bio: "Global pop and Amapiano star with the highest monthly listeners among SA acts. Grammy-winning artist putting South African sound on the world stage." },
  { id: "2", stage_name: "DJ Maphorisa", genre: "Amapiano", location: "Johannesburg", rate: 15000, image_url: "/artists/maphorisa.webp", bio: "Top Amapiano producer and hitmaker. Known for chart-topping collaborations and high-energy sets across South Africa and beyond." },
  { id: "3", stage_name: "Master KG", genre: "Amapiano / Afro Pop", location: "Limpopo", rate: 30000, image_url: "/artists/master-kg.webp", bio: "Global sensation known for Jerusalema. Producer and artist who took South African dance music to the world." },
  { id: "4", stage_name: "Kabza De Small", genre: "Amapiano", location: "Pretoria", rate: 18000, image_url: "/artists/kabza.webp", bio: "The acclaimed King of Amapiano. His productions have defined the sound of a generation across the continent." },
  { id: "5", stage_name: "Nomcebo Zikode", genre: "Afro Pop / Gospel", location: "Johannesburg", rate: 20000, image_url: "/artists/nomcebo.webp", bio: "Vocalist famous for massive international hits. Powerful voice behind some of SA's biggest crossover records." },
  { id: "6", stage_name: "Shimza", genre: "House / Electronic", location: "Johannesburg", rate: 25000, image_url: "/artists/shimza.webp", bio: "Electronic and house music heavyweight. Festival favourite with a global DJ footprint." },
  { id: "7", stage_name: "Black Coffee", genre: "Afro House", location: "Durban", rate: 50000, image_url: "/artists/black-coffee.webp", bio: "Grammy-winning international house DJ and producer. One of Africa's most influential electronic artists." },
  { id: "8", stage_name: "Tyler ICU", genre: "Amapiano", location: "Johannesburg", rate: 16000, image_url: "/artists/tyler-icu.webp", bio: "Chart-topping Amapiano producer behind major club anthems and viral dance tracks." },
  { id: "9", stage_name: "Nasty C", genre: "Hip Hop", location: "Durban", rate: 30000, image_url: "/artists/nasty-c.webp", bio: "South Africa's leading hip-hop export. Known for technical skill, catchy hooks, and sold-out shows." },
  { id: "10", stage_name: "Focalistic", genre: "Amapiano", location: "Pretoria", rate: 18000, image_url: "/artists/focalistic.webp", bio: "Amapiano star with massive street appeal and hit collaborations that dominate the charts." },
  { id: "11", stage_name: "Uncle Waffles", genre: "Amapiano", location: "Johannesburg", rate: 22000, image_url: "/artists/uncle-waffles.webp", bio: "High-energy Amapiano DJ and performer with a growing international following." },
  { id: "12", stage_name: "Kelvin Momo", genre: "Private School Piano", location: "Johannesburg", rate: 15000, image_url: "/artists/kelvin-momo.webp", bio: "Pioneer of the Private School Piano sound. Soulful, refined Amapiano for premium events." },
  { id: "13", stage_name: "Boohle", genre: "Amapiano", location: "Johannesburg", rate: 14000, image_url: "/artists/boohle.webp", bio: "Distinctive Amapiano vocalist featured on multiple chart-topping tracks." },
  { id: "14", stage_name: "Mellow & Sleazy", genre: "Amapiano", location: "Pretoria", rate: 16000, image_url: "/artists/mellow-sleazy.webp", bio: "Producer duo behind some of the most streamed Amapiano records in SA." },
  { id: "15", stage_name: "Kamo Mphela", genre: "Amapiano", location: "Johannesburg", rate: 15000, image_url: "/artists/kamo-mphela.webp", bio: "Dance and vocal force in Amapiano with infectious stage energy." },
  { id: "16", stage_name: "Daliwonga", genre: "Amapiano", location: "Johannesburg", rate: 14000, image_url: "/artists/daliwonga.webp", bio: "Amapiano vocalist known for melodic hooks and packed dance floors." },
  { id: "17", stage_name: "Ami Faku", genre: "Afro Pop / Soul", location: "Port Elizabeth", rate: 18000, image_url: "/artists/ami-faku.webp", bio: "Soulful vocalist and songwriter with crossover appeal across South Africa." },
  { id: "18", stage_name: "Nkosazana Daughter", genre: "Amapiano", location: "Johannesburg", rate: 14000, image_url: "/artists/nkosazana.webp", bio: "Sought-after vocal collaborator in Amapiano. Distinctive voice on major dancefloor records." },
  { id: "19", stage_name: "Blxckie", genre: "Hip Hop", location: "Durban", rate: 14000, image_url: "/artists/blxckie.webp", bio: "Versatile modern hip-hop and trap star. Melodic flows and viral hits from Durban." },
  { id: "20", stage_name: "Musa Keys", genre: "Amapiano", location: "Johannesburg", rate: 16000, image_url: "/artists/musa-keys.webp", bio: "Amapiano star with massive cross-border appeal. Producer and performer with club-ready hits." },
  { id: "21", stage_name: "A-Reece", genre: "Hip Hop", location: "Pretoria", rate: 25000, image_url: "/artists/areece.webp", bio: "One of South Africa's most respected lyricists. Known for introspective bars, independent hustle, and a cult following across the country." },
  { id: "22", stage_name: "Dlala Thukzin", genre: "Gqom", location: "Durban", rate: 20000, image_url: "/artists/dlala-thukzin.webp", bio: "Durban-based Gqom producer known for high-energy club anthems and collaborations that dominate dance floors nationwide." },
  { id: "23", stage_name: "DBN Gogo", genre: "Amapiano", location: "Durban", rate: 20000, image_url: "/artists/dbn-gogo.webp", bio: "One of South Africa's most recognized Amapiano DJs with major local and international performances." },
  { id: "24", stage_name: "Oscar Mbo", genre: "House", location: "Johannesburg", rate: 18000, image_url: "/artists/oscar-mbo.webp", bio: "Deep house DJ and producer known for soulful grooves and premium live sets." },
  { id: "25", stage_name: "Cassper Nyovest", genre: "Hip Hop", location: "Mahikeng / Johannesburg", rate: 35000, image_url: "/artists/cassper.webp", bio: "Multi-platinum hip-hop heavyweight and entrepreneur. Known for monumental live shows and a string of chart-topping albums." },
  { id: "26", stage_name: "Zee Nxumalo", genre: "Amapiano", location: "Johannesburg", rate: 18000, image_url: "/artists/zee-nxumalo.webp", bio: "One of South Africa's fastest-rising Amapiano stars, known for viral hits, powerful vocals, and strong youth appeal." },
  { id: "27", stage_name: "Tman Xpress", genre: "Amapiano", location: "Johannesburg", rate: 15000, image_url: "/artists/tman-xpress.webp", bio: "Popular Amapiano vocalist and songwriter responsible for numerous chart-topping collaborations and club anthems." },
  { id: "28", stage_name: "Scotts Maphuma", genre: "Amapiano", location: "Johannesburg", rate: 15000, image_url: "/artists/scotts-maphuma.webp", bio: "Emerging Amapiano hitmaker whose infectious vocals and energetic performances have made him a fan favorite." },
  { id: "29", stage_name: "Shakes & Les", genre: "Amapiano", location: "Pretoria", rate: 18000, image_url: "/artists/shakes-les.webp", bio: "Amapiano duo behind some of the genre's biggest streaming records and festival performances." },
  { id: "30", stage_name: "Major League DJz", genre: "Amapiano", location: "Johannesburg", rate: 30000, image_url: "/artists/major-league.webp", bio: "Globally recognized twin DJ duo credited with helping introduce Amapiano to international audiences." },
  { id: "31", stage_name: "Young Stunna", genre: "Amapiano", location: "Johannesburg", rate: 20000, image_url: "/artists/young-stunna.webp", bio: "Award-winning vocalist known for chart-dominating Amapiano songs and unforgettable live performances." },
  { id: "32", stage_name: "Makhadzi", genre: "Afro Pop", location: "Limpopo", rate: 30000, image_url: "/artists/makhadzi.webp", bio: "One of South Africa's most booked performers, celebrated for energetic stages and massive radio hits." },
  { id: "33", stage_name: "Big Zulu", genre: "Hip Hop", location: "Durban", rate: 25000, image_url: "/artists/big-zulu.webp", bio: "Award-winning rapper and songwriter with a huge fan base and strong crossover appeal." },
  { id: "34", stage_name: "MaWhoo", genre: "Amapiano", location: "KwaZulu-Natal", rate: 18000, image_url: "/artists/mawhoo.webp", bio: "One of the most sought-after Amapiano vocalists, known for her soulful voice and consistent hit records." },
  { id: "35", stage_name: "Sir Trill", genre: "Amapiano", location: "Badplaas", rate: 18000, image_url: "/artists/sir-trill.webp", bio: "Renowned Amapiano vocalist whose melodies have featured on some of the genre's most successful releases." },
  { id: "36", stage_name: "Mr JazziQ", genre: "Amapiano", location: "Pretoria", rate: 18000, image_url: "/artists/mr-jazziq.webp", bio: "One of the pioneers of modern Amapiano with an extensive catalogue of club and festival hits." },
  { id: "37", stage_name: "Scorpion Kings", genre: "Amapiano", location: "Johannesburg", rate: 60000, image_url: "/artists/scorpion-kings.webp", bio: "The legendary Scorpion Kings. A premium booking that consistently sells out venues and festivals." },
  { id: "38", stage_name: "Sjava", genre: "Afro Soul", location: "KwaZulu-Natal", rate: 25000, image_url: "/artists/sjava.webp", bio: "Award-winning singer and songwriter blending Afro Soul, Hip Hop, and traditional influences." },
  { id: "39", stage_name: "Zakwe", genre: "Hip Hop", location: "Durban", rate: 15000, image_url: "/artists/zakwe.webp", bio: "Respected lyricist and performer known for authentic storytelling and energetic live shows." },
  { id: "40", stage_name: "uMsebenzi Wethu", genre: "Amapiano", location: "Johannesburg", rate: 18000, image_url: "/artists/umsebenzi-wethu.webp", bio: "Popular Amapiano duo known for dancefloor hits and a rapidly growing national following." },
  { id: "41", stage_name: "LeeMcKrazy", genre: "Amapiano", location: "Johannesburg", rate: 16000, image_url: "/artists/leemckrazy.webp", bio: "Viral hitmaker and performer with a unique vocal style that dominates TikTok and club playlists." },
  { id: "42", stage_name: "Khanyisa", genre: "Amapiano", location: "Johannesburg", rate: 14000, image_url: "/artists/khanyisa.webp", bio: "Dynamic vocalist behind several Amapiano chart successes and high-energy live performances." },
  { id: "43", stage_name: "Logo Ricky", genre: "Amapiano", location: "Johannesburg", rate: 12000, image_url: "/artists/logo-ricky.webp", bio: "Producer and performer making waves with street anthems and energetic crowd engagement." },
  { id: "44", stage_name: "DJ Stokie", genre: "Amapiano", location: "Johannesburg", rate: 18000, image_url: "/artists/dj-stokie.webp", bio: "Veteran Amapiano DJ known for soulful sets and hit collaborations across the genre." },
  { id: "45", stage_name: "Pabi Cooper", genre: "Amapiano", location: "Pretoria", rate: 18000, image_url: "/artists/pabi-cooper.webp", bio: "Singer, dancer, and performer with immense youth appeal and several chart-topping releases." },
];

const DEMO_ARTIST_USER_ID = "demo-artist-user-001";
const DEMO_PROMOTER_USER_ID = "demo-promoter-user-001";
const DEMO_CATALOG_ARTIST_ID = "2"; // DJ Maphorisa
const DEMO_PASSWORD = "Demo1234!";

function isoOffset(days, time = "21:00") {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return { date: `${y}-${m}-${day}`, time };
}

// --- Artists (upsert all so new catalog IDs appear on existing DBs) ---
const insertArtist = db.prepare(`
  INSERT INTO artists (id, stage_name, genre, location, rate, image_url, bio)
  VALUES (@id, @stage_name, @genre, @location, @rate, @image_url, @bio)
  ON CONFLICT (id) DO UPDATE SET
    stage_name = EXCLUDED.stage_name,
    genre = EXCLUDED.genre,
    location = EXCLUDED.location,
    rate = EXCLUDED.rate,
    image_url = EXCLUDED.image_url,
    bio = EXCLUDED.bio
`);
for (const row of artists) {
  await insertArtist.run(row);
}
console.log(`Seed: artists upserted (${artists.length})`);


// --- Demo users (safe upsert without ON CONFLICT) ---
const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
const now = new Date().toISOString();

async function upsertUserRow(row) {
  const existing = await db
    .prepare("SELECT id FROM users WHERE id = ? OR LOWER(email) = LOWER(?)")
    .get(row.id, row.email);
  if (existing) {
    await db
      .prepare(
        `UPDATE users SET name = ?, email = ?, password = ?, role = ?, artist_id = ?
         WHERE id = ?`
      )
      .run(row.name, row.email, row.password, row.role, row.artist_id, existing.id);
  } else {
    await db
      .prepare(
        `INSERT INTO users (id, name, email, password, role, artist_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.id,
        row.name,
        row.email,
        row.password,
        row.role,
        row.artist_id,
        row.created_at
      );
  }
}

await upsertUserRow({
  id: DEMO_ARTIST_USER_ID,
  name: "DJ Maphorisa",
  email: "artist@thelineup.co.za",
  password: passwordHash,
  role: "artist",
  artist_id: DEMO_CATALOG_ARTIST_ID,
  created_at: now,
});
// Promoter is stored as role "client" in DB (API maps client → promoter)
await upsertUserRow({
  id: DEMO_PROMOTER_USER_ID,
  name: "Thabo Events",
  email: "promoter@thelineup.co.za",
  password: passwordHash,
  role: "client",
  artist_id: null,
  created_at: now,
});
console.log("Seed: demo users ready (artist@ / promoter@  password Demo1234!)");

// --- Sample bookings for simulation (upsert by fixed ids) ---
const g1 = isoOffset(3);
const g2 = isoOffset(8);
const g3 = isoOffset(-5);
const g4 = isoOffset(1);

async function upsertBookingRow(row) {
  const existing = await db.prepare("SELECT id FROM bookings WHERE id = ?").get(row.id);
  if (existing) {
    await db
      .prepare(
        `UPDATE bookings SET status = ?, payment_status = ?, fee = ?, event_date = ?
         WHERE id = ?`
      )
      .run(row.status, row.payment_status, row.fee, row.event_date, row.id);
  } else {
    await db
      .prepare(
        `INSERT INTO bookings (
          id, artist_id, artist_name, client_name, client_email, event_date, venue, message,
          status, created_at, address, city, time, fee, promoter_name, promoter_id, notes,
          reminder_opt_in, payment_status, paid_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.id,
        row.artist_id,
        row.artist_name,
        row.client_name,
        row.client_email,
        row.event_date,
        row.venue,
        row.message,
        row.status,
        row.created_at,
        row.address,
        row.city,
        row.time,
        row.fee,
        row.promoter_name,
        row.promoter_id,
        row.notes,
        row.reminder_opt_in,
        row.payment_status,
        row.paid_at
      );
  }
}

const sampleBookings = [
  {
    id: "demo-booking-pending-1",
    artist_id: DEMO_CATALOG_ARTIST_ID,
    artist_name: "DJ Maphorisa",
    client_name: "Thabo Events",
    client_email: "promoter@thelineup.co.za",
    event_date: g1.date,
    venue: "Sandton Convention Centre",
    message: "Amapiano night — 2 hour set, VIP room available for green room.",
    status: "pending",
    created_at: now,
    address: "161 Maude St",
    city: "Sandton",
    time: g1.time,
    fee: 15000,
    promoter_name: "Thabo Events",
    promoter_id: DEMO_PROMOTER_USER_ID,
    notes: "Pending your accept / decline",
    reminder_opt_in: 1,
    payment_status: "unpaid",
    paid_at: null,
  },
  {
    id: "demo-booking-confirmed-1",
    artist_id: DEMO_CATALOG_ARTIST_ID,
    artist_name: "DJ Maphorisa",
    client_name: "Thabo Events",
    client_email: "promoter@thelineup.co.za",
    event_date: g2.date,
    venue: "The Orbit, Braamfontein",
    message: "Club residency slot — doors 21:00.",
    status: "confirmed",
    created_at: now,
    address: "81 De Korte St",
    city: "Johannesburg",
    time: g2.time,
    fee: 18000,
    promoter_name: "Thabo Events",
    promoter_id: DEMO_PROMOTER_USER_ID,
    notes: "Accepted — awaiting deposit",
    reminder_opt_in: 1,
    payment_status: "unpaid",
    paid_at: null,
  },
  {
    id: "demo-booking-paid-1",
    artist_id: DEMO_CATALOG_ARTIST_ID,
    artist_name: "DJ Maphorisa",
    client_name: "Thabo Events",
    client_email: "promoter@thelineup.co.za",
    event_date: g3.date,
    venue: "Joburg Theatre Outdoor",
    message: "Festival side stage — completed.",
    status: "paid",
    created_at: now,
    address: "Loveday St",
    city: "Johannesburg",
    time: "20:00",
    fee: 20000,
    promoter_name: "Thabo Events",
    promoter_id: DEMO_PROMOTER_USER_ID,
    notes: "Paid in full",
    reminder_opt_in: 0,
    payment_status: "paid",
    paid_at: now,
  },
  {
    id: "demo-booking-pending-other",
    artist_id: DEMO_CATALOG_ARTIST_ID,
    artist_name: "DJ Maphorisa",
    client_name: "Cape Town Live",
    client_email: "bookings@capetownlive.co.za",
    event_date: g4.date,
    venue: "Arcade Empire",
    message: "New request from another promoter — review in dashboard.",
    status: "pending",
    created_at: now,
    address: "Long St",
    city: "Cape Town",
    time: g4.time,
    fee: 16000,
    promoter_name: "Cape Town Live",
    promoter_id: null,
    notes: "",
    reminder_opt_in: 0,
    payment_status: "unpaid",
    paid_at: null,
  },
];

for (const row of sampleBookings) {
  await upsertBookingRow(row);
}
console.log(`Seed: ${sampleBookings.length} sample bookings linked to DJ Maphorisa (id 2)`);

const userCount = (await db.prepare("SELECT COUNT(*) AS c FROM users").get())?.c;
const bookingCount = (await db.prepare("SELECT COUNT(*) AS c FROM bookings").get())?.c;
const artistCount = (await db.prepare("SELECT COUNT(*) AS c FROM artists").get())?.c;
console.log(
  `Seed complete. Artists: ${artistCount}, Users: ${userCount}, Bookings: ${bookingCount}`
);

}

const seedPromise = seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exitCode = 1;
  throw e;
});
export default seedPromise;
