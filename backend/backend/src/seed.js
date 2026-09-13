import db from "./db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    stage_name TEXT NOT NULL,
    genre TEXT,
    location TEXT,
    rate INTEGER,
    image_url TEXT,
    bio TEXT
  );
`);

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
  { id: "10", stage_name: "Sjava", genre: "Afro Soul / Maskandi", location: "Durban", rate: 22000, image_url: "/artists/sjava.webp", bio: "Award-winning Afro-soul and hip-hop artist. Blends maskandi, storytelling and contemporary SA sound." },
  { id: "11", stage_name: "Kelvin Momo", genre: "Private School Piano", location: "Johannesburg", rate: 16000, image_url: "/artists/kelvin-momo.webp", bio: "Pioneer of private-school Amapiano. Smooth, soulful productions that define late-night sessions nationwide." },
  { id: "12", stage_name: "Mellow & Sleazy", genre: "Amapiano", location: "Pretoria", rate: 18000, image_url: "/artists/mellow-sleazy.webp", bio: "Popular Amapiano production duo. Hard-hitting log drums and anthemic club energy." },
  { id: "13", stage_name: "Focalistic", genre: "Amapiano", location: "Pretoria", rate: 22000, image_url: "/artists/focalistic.webp", bio: "High-energy Amapiano rapper and performer. Street energy with melodic hooks for clubs and festivals." },
  { id: "14", stage_name: "Uncle Waffles", genre: "Amapiano", location: "Eswatini / Johannesburg", rate: 28000, image_url: "/artists/uncle-waffles.webp", bio: "Global Amapiano DJ and festival headliner. Iconic dances and main-stage presence worldwide." },
  { id: "15", stage_name: "Makhadzi", genre: "Limpopo Pop / Dance", location: "Limpopo", rate: 18000, image_url: "/artists/makhadzi.webp", bio: "Limpopo pop and dance queen. High-energy performer with a massive local following." },
  { id: "16", stage_name: "Young Stunna", genre: "Amapiano", location: "Johannesburg", rate: 15000, image_url: "/artists/young-stunna.webp", bio: "Vocal powerhouse on major Amapiano tracks. Sought after for live performances and collabs." },
  { id: "17", stage_name: "Boohle", genre: "Amapiano", location: "Johannesburg", rate: 17000, image_url: "/artists/boohle.webp", bio: "Talented singer and songwriter in the dance scene. Voice behind countless Amapiano hits." },
  { id: "18", stage_name: "Nkosazana Daughter", genre: "Amapiano", location: "Johannesburg", rate: 14000, image_url: "/artists/nkosazana.webp", bio: "Sought-after vocal collaborator in Amapiano. Distinctive voice on major dancefloor records." },
  { id: "19", stage_name: "Blxckie", genre: "Hip Hop", location: "Durban", rate: 14000, image_url: "/artists/blxckie.webp", bio: "Versatile modern hip-hop and trap star. Melodic flows and viral hits from Durban." },
  { id: "20", stage_name: "Musa Keys", genre: "Amapiano", location: "Johannesburg", rate: 16000, image_url: "/artists/musa-keys.webp", bio: "Amapiano star with massive cross-border appeal. Producer and performer with club-ready hits." },
  { id: "21", stage_name: "A-Reece", genre: "Hip Hop", location: "Pretoria", rate: 25000, image_url: "/artists/areece.webp", bio: "One of South Africa's most respected lyricists. Known for introspective bars, independent hustle, and a cult following across the country." },
  { id: "22", stage_name: "Dlala Thukzin", genre: "Gqom", location: "Durban", rate: 20000, image_url: "/artists/dlala-thukzin.webp", bio: "Durban-based Gqom producer known for high-energy club anthems and collaborations that dominate dance floors nationwide." },
  { id: "23", stage_name: "DBN Gogo", genre: "Amapiano", location: "Durban", rate: 20000, image_url: "/artists/dbn-gogo.webp", bio: "One of South Africa's most recognized Amapiano DJs with major local and international performances." },
  { id: "24", stage_name: "Oscar Mbo", genre: "House", location: "Johannesburg", rate: 18000, image_url: "/artists/oscar-mbo.webp", bio: "Deep house DJ and producer known for soulful grooves and premium live sets." },
  { id: "25", stage_name: "Cassper Nyovest", genre: "Hip Hop", location: "Mahikeng / Johannesburg", rate: 35000, image_url: "/artists/cassper.webp", bio: "Multi-platinum hip-hop heavyweight and entrepreneur. Known for monumental live shows and a string of chart-topping albums." },
];

const insert = db.prepare(`
  INSERT OR REPLACE INTO artists (
    id, stage_name, genre, location, rate, image_url, bio
  ) VALUES (
    @id, @stage_name, @genre, @location, @rate, @image_url, @bio
  )
`);

db.prepare("DELETE FROM artists").run();

const insertMany = db.transaction((rows) => {
  for (const row of rows) insert.run(row);
});

insertMany(artists);
const count = db.prepare("SELECT COUNT(*) AS c FROM artists").get();
console.log(`Seed complete. Artists: ${count.c}`);
