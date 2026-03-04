// Trivia Quiz question pool — ~400 questions across 7 categories
// Each question: { text, options: [4], correctIndex, category, difficulty }
// difficulty: 'easy' | 'medium' | 'hard'

const QUESTIONS = [
  // ═══════════════════════════════════════════
  // CINEMA (~60)
  // ═══════════════════════════════════════════

  // --- cinema easy ---
  { text: 'Chi ha diretto "Jurassic Park"?', options: ['James Cameron', 'Steven Spielberg', 'George Lucas', 'Michael Bay'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Chi interpreta Iron Man nel MCU?', options: ['Chris Evans', 'Robert Downey Jr.', 'Chris Hemsworth', 'Mark Ruffalo'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Chi interpreta Jack Sparrow?', options: ['Brad Pitt', 'Johnny Depp', 'Orlando Bloom', 'Robert Downey Jr.'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Quale film ha il famoso "bullet time"?', options: ['Terminator 2', 'The Matrix', 'John Wick', 'Blade Runner'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Chi ha diretto "Avatar" (2009)?', options: ['Steven Spielberg', 'James Cameron', 'Peter Jackson', 'George Lucas'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Quale film ha un DeLorean come macchina del tempo?', options: ['Terminator', 'Ritorno al Futuro', 'Tenet', 'Interstellar'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Quale studio di produzione ha il logo del castello?', options: ['Universal', 'Walt Disney', 'Paramount', 'Warner Bros'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'In che anno è uscito il primo "Star Wars"?', options: ['1975', '1977', '1979', '1980'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Chi ha diretto "Pulp Fiction"?', options: ['Martin Scorsese', 'Quentin Tarantino', 'David Lynch', 'Guy Ritchie'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Quale film ha come protagonista un pesce pagliaccio?', options: ['Shark Tale', 'Alla Ricerca di Nemo', 'La Sirenetta', 'Moana'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Quale film di Pixar ha le emozioni come personaggi?', options: ['Coco', 'Inside Out', 'Soul', 'Up'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Chi ha diretto "Inception" (2010)?', options: ['Christopher Nolan', 'Steven Spielberg', 'Martin Scorsese', 'Ridley Scott'], correctIndex: 0, category: 'cinema', difficulty: 'easy' },
  { text: 'In "Forrest Gump", chi è l\'attore protagonista?', options: ['Robin Williams', 'Tom Hanks', 'Jim Carrey', 'Bill Murray'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Quale regista italiano ha diretto "La Vita è Bella"?', options: ['Federico Fellini', 'Roberto Benigni', 'Paolo Sorrentino', 'Giuseppe Tornatore'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'In "Matrix", quale pillola sceglie Neo?', options: ['Blu', 'Rossa', 'Verde', 'Nessuna'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Quale film ha come cattivo Thanos?', options: ['Justice League', 'Avengers: Infinity War', 'X-Men', 'Guardiani della Galassia'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Chi ha interpretato il Joker in "Il Cavaliere Oscuro"?', options: ['Jack Nicholson', 'Heath Ledger', 'Jared Leto', 'Joaquin Phoenix'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'In "Whiplash", quale strumento suona il protagonista?', options: ['Pianoforte', 'Batteria', 'Tromba', 'Sassofono'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Chi ha diretto "E.T. l\'Extra-Terrestre"?', options: ['George Lucas', 'Steven Spielberg', 'Robert Zemeckis', 'Joe Dante'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Quale studio ha prodotto "Shrek"?', options: ['Pixar', 'DreamWorks', 'Illumination', 'Blue Sky'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },

  // --- cinema medium ---
  { text: 'In quale anno è uscito "Il Padrino"?', options: ['1970', '1972', '1974', '1968'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'Quale film ha vinto il primo Oscar per i Migliori Effetti Visivi?', options: ['Star Wars', 'Alien', 'Superman', 'Tron'], correctIndex: 0, category: 'cinema', difficulty: 'medium' },
  { text: 'Chi ha diretto "Blade Runner" (1982)?', options: ['James Cameron', 'Ridley Scott', 'Steven Spielberg', 'George Lucas'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'Quale film del 2019 ha vinto la Palma d\'Oro e l\'Oscar come Miglior Film?', options: ['1917', 'Parasite', 'Joker', 'Once Upon a Time in Hollywood'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'Quale film del 2014 è girato come un unico piano sequenza?', options: ['Gravity', 'Birdman', 'Boyhood', 'Gone Girl'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'Chi ha diretto "Mad Max: Fury Road"?', options: ['Ridley Scott', 'George Miller', 'Denis Villeneuve', 'Christopher Nolan'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'Chi ha diretto "Dune" (2021)?', options: ['Christopher Nolan', 'Denis Villeneuve', 'Ridley Scott', 'Alex Garland'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'Quale regista è noto per i piani sequenza lunghi come "Roma" e "Gravity"?', options: ['Quentin Tarantino', 'Alfonso Cuarón', 'Christopher Nolan', 'Michael Bay'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'Quale film di Scorsese racconta la storia di un tassista?', options: ['Goodfellas', 'Taxi Driver', 'Mean Streets', 'Casino'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'In "No Country for Old Men", chi interpreta il cattivo Anton Chigurh?', options: ['Josh Brolin', 'Javier Bardem', 'Tommy Lee Jones', 'Woody Harrelson'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'Chi ha diretto "Parasite"?', options: ['Park Chan-wook', 'Bong Joon-ho', 'Kim Ki-duk', 'Lee Chang-dong'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'In "La La Land", chi sono i due protagonisti?', options: ['Leonardo DiCaprio e Kate Winslet', 'Ryan Gosling e Emma Stone', 'Brad Pitt e Margot Robbie', 'Timothée Chalamet e Saoirse Ronan'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'Quale regista ha fatto "Mulholland Drive"?', options: ['David Fincher', 'David Lynch', 'David Cronenberg', 'Darren Aronofsky'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'Chi ha diretto "The Revenant"?', options: ['Terrence Malick', 'Alejandro González Iñárritu', 'Alfonso Cuarón', 'Guillermo del Toro'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'Chi ha diretto "Get Out" (2017)?', options: ['Ari Aster', 'Jordan Peele', 'James Wan', 'Robert Eggers'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'Quale film di Wes Anderson ha un hotel coloratissimo?', options: ['Moonrise Kingdom', 'The Grand Budapest Hotel', 'The Royal Tenenbaums', 'Fantastic Mr. Fox'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },

  // --- cinema hard ---
  { text: 'Quale film del 1927 è considerato il primo "talkie" (film sonoro)?', options: ['Metropolis', 'Il cantante di jazz', 'Sunrise', 'The General'], correctIndex: 1, category: 'cinema', difficulty: 'hard' },
  { text: 'Quale direttore della fotografia ha vinto 3 Oscar consecutivi tra il 2013 e il 2015?', options: ['Roger Deakins', 'Emmanuel Lubezki', 'Janusz Kamiński', 'Robert Richardson'], correctIndex: 1, category: 'cinema', difficulty: 'hard' },
  { text: 'Quale formato pellicola usa "Oppenheimer" di Nolan per le scene a colori IMAX?', options: ['Super 35mm', 'IMAX 65mm', 'VistaVision', 'Super 16mm'], correctIndex: 1, category: 'cinema', difficulty: 'hard' },
  { text: 'Quale tecnica ha usato Hitchcock in "Rope" per simulare un unico piano sequenza?', options: ['Montaggio nascosto con zoom su oggetti scuri', 'Reverse photography', 'Time-lapse con dissolvenze', 'Split screen digitale'], correctIndex: 0, category: 'cinema', difficulty: 'hard' },
  { text: 'Chi è il direttore della fotografia di "Blade Runner 2049"?', options: ['Emmanuel Lubezki', 'Roger Deakins', 'Hoyte van Hoytema', 'Bradford Young'], correctIndex: 1, category: 'cinema', difficulty: 'hard' },
  { text: 'In quale anno la Academy ha introdotto la categoria "Best Animated Feature"?', options: ['1998', '2001', '1995', '2003'], correctIndex: 1, category: 'cinema', difficulty: 'hard' },
  { text: 'Quale film di Kubrick ha utilizzato solo luce naturale e candele per le scene in interni?', options: ['2001: Odissea nello Spazio', 'Barry Lyndon', 'Arancia Meccanica', 'Eyes Wide Shut'], correctIndex: 1, category: 'cinema', difficulty: 'hard' },
  { text: 'Quale lente speciale usò Kubrick per le scene a lume di candela in Barry Lyndon?', options: ['Cooke S4', 'Zeiss Planar 50mm f/0.7', 'Panavision Primo 70', 'Angénieux Optimo'], correctIndex: 1, category: 'cinema', difficulty: 'hard' },

  // ═══════════════════════════════════════════
  // ANIMAZIONE (~58)
  // ═══════════════════════════════════════════

  // --- animazione easy ---
  { text: 'Quale studio ha creato "Toy Story"?', options: ['DreamWorks', 'Pixar', 'Illumination', 'Blue Sky'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },
  { text: 'Quanti FPS ha un\'animazione cinematografica standard?', options: ['12', '24', '30', '60'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },
  { text: 'Quale studio ha prodotto "Frozen"?', options: ['Pixar', 'Walt Disney Animation', 'DreamWorks', 'Illumination'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },
  { text: 'Chi ha fondato lo Studio Ghibli?', options: ['Akira Toriyama', 'Hayao Miyazaki', 'Makoto Shinkai', 'Satoshi Kon'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },
  { text: 'Quale film Pixar ha come protagonista un topo chef?', options: ['Coco', 'Ratatouille', 'Up', 'WALL-E'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },
  { text: 'Chi ha creato "Dragon Ball"?', options: ['Hayao Miyazaki', 'Akira Toriyama', 'Eiichiro Oda', 'Masashi Kishimoto'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },
  { text: 'Quale studio ha prodotto "Minions"?', options: ['DreamWorks', 'Pixar', 'Illumination', 'Laika'], correctIndex: 2, category: 'animazione', difficulty: 'easy' },
  { text: 'Quale film Pixar ha un robot solo sulla Terra?', options: ['Cars', 'WALL-E', 'Lightyear', 'Inside Out'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },
  { text: 'Quale film DreamWorks ha un drago come amico?', options: ['Shrek', 'Dragon Trainer', 'Kung Fu Panda', 'Madagascar'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },
  { text: 'Quale film Ghibli ha un castello volante?', options: ['Principessa Mononoke', 'Il Castello Errante di Howl', 'La Città Incantata', 'Ponyo'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },
  { text: 'In "Monsters, Inc.", cosa alimenta la città?', options: ['Elettricità', 'Le urla dei bambini', 'Il sole', 'Il vento'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },
  { text: 'Quale film Pixar è ambientato nel mondo dei morti messicano?', options: ['Soul', 'Coco', 'Inside Out', 'Onward'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },
  { text: 'Quale studio ha prodotto "Coraline"?', options: ['Pixar', 'DreamWorks', 'Laika', 'Aardman'], correctIndex: 2, category: 'animazione', difficulty: 'easy' },
  { text: 'Quale film di Makoto Shinkai è del 2016?', options: ['Weathering with You', 'Your Name', '5 Centimeters per Second', 'The Garden of Words'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },
  { text: 'Qual è il software di animazione 3D open-source più famoso?', options: ['Maya', 'Cinema 4D', 'Blender', '3ds Max'], correctIndex: 2, category: 'animazione', difficulty: 'easy' },

  // --- animazione medium ---
  { text: 'Quanti sono i principi classici dell\'animazione Disney?', options: ['8', '10', '12', '15'], correctIndex: 2, category: 'animazione', difficulty: 'medium' },
  { text: 'Cosa significa "rigging" in animazione 3D?', options: ['Creare texture', 'Creare lo scheletro di un modello', 'Aggiungere luci', 'Fare il rendering'], correctIndex: 1, category: 'animazione', difficulty: 'medium' },
  { text: 'Quale tecnica anima fotogramma per fotogramma con pupazzi?', options: ['Motion capture', 'Rotoscoping', 'Stop motion', 'Cel animation'], correctIndex: 2, category: 'animazione', difficulty: 'medium' },
  { text: 'Cos\'è il "squash and stretch" in animazione?', options: ['Un tipo di rendering', 'Un principio di animazione per dare peso e flessibilità', 'Un software', 'Una tecnica di modellazione'], correctIndex: 1, category: 'animazione', difficulty: 'medium' },
  { text: 'Cos\'è il "motion capture"?', options: ['Catturare il movimento di attori reali', 'Animazione frame by frame', 'Rendering in tempo reale', 'Creazione di modelli 3D'], correctIndex: 0, category: 'animazione', difficulty: 'medium' },
  { text: 'Cos\'è un "keyframe"?', options: ['Il frame finale', 'Un frame chiave che definisce una posa', 'Il primo frame', 'Un frame vuoto'], correctIndex: 1, category: 'animazione', difficulty: 'medium' },
  { text: 'Quale software è lo standard per l\'animazione 3D professionale?', options: ['Blender', 'Maya', 'Cinema 4D', 'Houdini'], correctIndex: 1, category: 'animazione', difficulty: 'medium' },
  { text: 'Cos\'è il "cel shading"?', options: ['Rendering che simula il look 2D/cartoon', 'Un tipo di ombreggiatura realistica', 'Una tecnica di compositing', 'Un filtro post-produzione'], correctIndex: 0, category: 'animazione', difficulty: 'medium' },
  { text: 'Quale software è specializzato in effetti procedurali e simulazioni?', options: ['Maya', 'Houdini', 'Blender', 'Cinema 4D'], correctIndex: 1, category: 'animazione', difficulty: 'medium' },
  { text: 'Cos\'è la "inverse kinematics" (IK)?', options: ['Un tipo di rendering', 'Calcolo automatico delle articolazioni da un punto finale', 'Un effetto di luce', 'Un tipo di texture'], correctIndex: 1, category: 'animazione', difficulty: 'medium' },
  { text: 'Quale studio ha prodotto "Spider-Verse"?', options: ['Pixar', 'Sony Pictures Animation', 'DreamWorks', 'Illumination'], correctIndex: 1, category: 'animazione', difficulty: 'medium' },
  { text: 'Cos\'è il "weight painting"?', options: ['Dipingere texture', 'Assegnare l\'influenza dei bones sulla mesh', 'Colorare i frame', 'Un effetto di post-produzione'], correctIndex: 1, category: 'animazione', difficulty: 'medium' },
  { text: 'Cos\'è l\'"onion skinning"?', options: ['Un effetto speciale', 'Vedere i frame precedenti/successivi sovrapposti', 'Un tipo di texture', 'Un filtro colore'], correctIndex: 1, category: 'animazione', difficulty: 'medium' },
  { text: 'Cos\'è il "graph editor" in animazione?', options: ['Un editor di immagini', 'Un tool per modificare le curve di interpolazione', 'Un editor audio', 'Un tool di modellazione'], correctIndex: 1, category: 'animazione', difficulty: 'medium' },
  { text: 'Quale software di scultura 3D è famoso per i dettagli organici?', options: ['Maya', 'ZBrush', 'Blender', '3ds Max'], correctIndex: 1, category: 'animazione', difficulty: 'medium' },
  { text: 'Cos\'è un "blend shape" o "morph target"?', options: ['Un tipo di luce', 'Una deformazione del mesh per espressioni facciali', 'Un filtro video', 'Un effetto particellare'], correctIndex: 1, category: 'animazione', difficulty: 'medium' },

  // --- animazione hard ---
  { text: 'In quale anno Pixar ha rilasciato il primo cortometraggio interamente in CGI, "André and Wally B."?', options: ['1982', '1984', '1986', '1988'], correctIndex: 1, category: 'animazione', difficulty: 'hard' },
  { text: 'Quale algoritmo di suddivisione delle superfici è usato di default in Pixar\'s RenderMan?', options: ['Loop', 'Catmull-Clark', 'Doo-Sabin', 'Butterfly'], correctIndex: 1, category: 'animazione', difficulty: 'hard' },
  { text: 'Quale tecnica usa "Spider-Verse" per simulare il look dei fumetti a frame variabili?', options: ['Rendering a 12fps con smear frames', 'Animazione su 2 e 3 con step interpolation', 'Cel shading con motion blur disabilitato', 'Rotoscoping su live action'], correctIndex: 1, category: 'animazione', difficulty: 'hard' },
  { text: 'Quale tipo di curva usa Maya di default per l\'interpolazione tra keyframe?', options: ['Lineare', 'Step', 'Bézier cubica', 'Hermite'], correctIndex: 2, category: 'animazione', difficulty: 'hard' },
  { text: 'In un rig IK/FK, cosa fa uno switch IK/FK "seamless"?', options: ['Cambia il colore dei controlli', 'Mantiene la posa durante il passaggio tra i due sistemi', 'Aggiunge constraint temporanei', 'Resetta tutte le rotazioni a zero'], correctIndex: 1, category: 'animazione', difficulty: 'hard' },
  { text: 'Quale formato è lo standard per lo scambio di blend shapes tra software diversi?', options: ['FBX', 'OBJ sequenze', 'Alembic con attributi', 'Collada'], correctIndex: 0, category: 'animazione', difficulty: 'hard' },
  { text: 'In Houdini, quale tipo di geometria è usato per simulazioni di fluidi FLIP?', options: ['Mesh poligonale', 'Particle (points)', 'NURBS', 'Voxel grid'], correctIndex: 1, category: 'animazione', difficulty: 'hard' },
  { text: 'Quale studio ha sviluppato Presto, il software di animazione proprietario usato da Pixar?', options: ['ILM', 'Pixar stessa', 'Autodesk', 'SideFX'], correctIndex: 1, category: 'animazione', difficulty: 'hard' },
  { text: 'Quale principio di animazione è più difficile da applicare in stop motion rispetto al 3D?', options: ['Staging', 'Squash and Stretch', 'Timing', 'Appeal'], correctIndex: 1, category: 'animazione', difficulty: 'hard' },
  { text: 'Cosa rappresenta la "tangent weight" nel graph editor di Maya?', options: ['Il peso del personaggio', 'L\'influenza/lunghezza della tangente sulla curva di animazione', 'La velocità del playback', 'La priorità del layer'], correctIndex: 1, category: 'animazione', difficulty: 'hard' },

  // ═══════════════════════════════════════════
  // VFX (~58)
  // ═══════════════════════════════════════════

  // --- vfx easy ---
  { text: 'Cos\'è il "green screen"?', options: ['Un monitor speciale', 'Uno sfondo per il chroma key', 'Un filtro colore', 'Un tipo di telecamera'], correctIndex: 1, category: 'vfx', difficulty: 'easy' },
  { text: 'Cosa significa "compositing" nei VFX?', options: ['Modellare oggetti 3D', 'Combinare elementi visivi in un\'unica immagine', 'Registrare audio', 'Scrivere sceneggiature'], correctIndex: 1, category: 'vfx', difficulty: 'easy' },
  { text: 'Cosa sono i "particle systems" nei VFX?', options: ['Sistemi di illuminazione', 'Simulazioni di fumo/fuoco/pioggia', 'Telecamere virtuali', 'Strumenti di editing'], correctIndex: 1, category: 'vfx', difficulty: 'easy' },
  { text: 'Quale film del 2009 ha rivoluzionato il motion capture facciale?', options: ['Avatar', 'Transformers', 'Star Trek', 'District 9'], correctIndex: 0, category: 'vfx', difficulty: 'easy' },
  { text: 'Quale azienda VFX ha creato gli effetti di "Il Signore degli Anelli"?', options: ['ILM', 'Weta Digital', 'Double Negative', 'Framestore'], correctIndex: 1, category: 'vfx', difficulty: 'easy' },
  { text: 'Quale software è famoso per le simulazioni fisiche VFX?', options: ['Maya', 'Houdini', 'Blender', 'After Effects'], correctIndex: 1, category: 'vfx', difficulty: 'easy' },
  { text: 'Quale film ha introdotto i dinosauri CGI realistici?', options: ['King Kong', 'Jurassic Park', 'Avatar', 'Godzilla'], correctIndex: 1, category: 'vfx', difficulty: 'easy' },
  { text: 'Cos\'è il "motion blur" nei VFX?', options: ['Sfocatura dovuta al movimento', 'Un tipo di stabilizzazione', 'Un effetto sonoro', 'Una tecnica di montaggio'], correctIndex: 0, category: 'vfx', difficulty: 'easy' },
  { text: 'Quale tecnologia ha usato "The Mandalorian" al posto del green screen?', options: ['Proiezione frontale', 'StageCraft (LED wall)', 'Blue screen', 'Matte painting fisico'], correctIndex: 1, category: 'vfx', difficulty: 'easy' },
  { text: 'Cos\'è il "CG integration"?', options: ['Inserire elementi 3D in riprese reali', 'Comprimere video', 'Registrare audio', 'Montare scene'], correctIndex: 0, category: 'vfx', difficulty: 'easy' },
  { text: 'Quale formato immagine è lo standard VFX per l\'alta gamma dinamica?', options: ['.jpg', '.png', '.exr', '.tiff'], correctIndex: 2, category: 'vfx', difficulty: 'easy' },
  { text: 'Quale software è standard per il compositing professionale?', options: ['Photoshop', 'After Effects', 'Nuke', 'Premiere'], correctIndex: 2, category: 'vfx', difficulty: 'easy' },
  { text: 'Cos\'è il "de-aging" nei VFX?', options: ['Invecchiare digitalmente un attore', 'Ringiovanire digitalmente un attore', 'Cambiare il colore della pelle', 'Aggiungere capelli'], correctIndex: 1, category: 'vfx', difficulty: 'easy' },

  // --- vfx medium ---
  { text: 'Cos\'è il "rotoscoping"?', options: ['Tracciare manualmente i contorni frame per frame', 'Un tipo di rendering', 'Una tecnica audio', 'Un formato video'], correctIndex: 0, category: 'vfx', difficulty: 'medium' },
  { text: 'Cos\'è il "match moving" o camera tracking?', options: ['Muovere la camera durante le riprese', 'Ricostruire il movimento della camera reale in 3D', 'Stabilizzazione video', 'Una tecnica di montaggio'], correctIndex: 1, category: 'vfx', difficulty: 'medium' },
  { text: 'Cos\'è un "matte painting" digitale?', options: ['Un tipo di vernice', 'Un\'illustrazione che estende o crea ambienti', 'Un effetto sonoro', 'Un tipo di telecamera'], correctIndex: 1, category: 'vfx', difficulty: 'medium' },
  { text: 'Quale tecnica VFX crea illuminazione da foto a 360°?', options: ['HDRI lighting', 'Rotoscoping', 'Wire removal', 'Speed ramp'], correctIndex: 0, category: 'vfx', difficulty: 'medium' },
  { text: 'Cos\'è un "plate" nei VFX?', options: ['Il piatto dell\'attrezzista', 'La ripresa originale su cui lavorare', 'Un tipo di lente', 'Un formato di rendering'], correctIndex: 1, category: 'vfx', difficulty: 'medium' },
  { text: 'Cos\'è il "deep compositing"?', options: ['Compositing con dati di profondità per ogni pixel', 'Un tipo di color grading', 'Un effetto 3D stereoscopico', 'Un formato video'], correctIndex: 0, category: 'vfx', difficulty: 'medium' },
  { text: 'Cos\'è un "render pass" o AOV?', options: ['Un singolo layer di rendering (diffuse, specular, etc.)', 'Il rendering completo', 'Un formato video', 'Un tipo di camera'], correctIndex: 0, category: 'vfx', difficulty: 'medium' },
  { text: 'Quale spazio colore è lo standard per la produzione cinematografica end-to-end?', options: ['sRGB', 'Adobe RGB', 'ACES', 'Rec. 709'], correctIndex: 2, category: 'vfx', difficulty: 'medium' },
  { text: 'Cos\'è il "photogrammetry"?', options: ['Fotografare con il flash', 'Creare modelli 3D da fotografie', 'Un tipo di stampa', 'Un formato immagine'], correctIndex: 1, category: 'vfx', difficulty: 'medium' },
  { text: 'Cos\'è il "volumetric rendering"?', options: ['Rendering di volumi (nebbia, nuvole, fumo)', 'Un tipo di compositing', 'Un formato di esportazione', 'Un tipo di modellazione'], correctIndex: 0, category: 'vfx', difficulty: 'medium' },
  { text: 'Quale render engine è famoso per il rendering fisicamente accurato usato da molti studi?', options: ['Scanline', 'Arnold', 'Eevee', 'Redshift solo'], correctIndex: 1, category: 'vfx', difficulty: 'medium' },
  { text: 'Cos\'è il "LiDAR scanning" nei VFX?', options: ['Scansione laser di ambienti reali per creare modelli 3D', 'Un tipo di camera', 'Un formato audio', 'Un effetto di luce'], correctIndex: 0, category: 'vfx', difficulty: 'medium' },
  { text: 'Cos\'è il "grain matching" in compositing?', options: ['Aggiungere grana al CG per matchare il footage reale', 'Un tipo di audio mixing', 'Un effetto di colore', 'Un formato file'], correctIndex: 0, category: 'vfx', difficulty: 'medium' },
  { text: 'Quale formato file è usato per lo scambio di scene 3D animate tra software?', options: ['.fbx', '.obj', '.abc (Alembic)', '.stl'], correctIndex: 2, category: 'vfx', difficulty: 'medium' },
  { text: 'Cos\'è il "set extension" nei VFX?', options: ['Costruire set fisici più grandi', 'Estendere digitalmente un set reale', 'Un tipo di camera', 'Un effetto audio'], correctIndex: 1, category: 'vfx', difficulty: 'medium' },

  // --- vfx hard ---
  { text: 'In Nuke, cosa fa il nodo "Scanline Render" rispetto al "Ray Render"?', options: ['Renderizza solo wireframe', 'Usa rasterizzazione scanline più veloce senza GI', 'Renderizza solo ombre', 'È identico ma per GPU'], correctIndex: 1, category: 'vfx', difficulty: 'hard' },
  { text: 'Quale formato file supporta nativamente i livelli di profondità per il deep compositing?', options: ['PNG a 16 bit', 'EXR 2.0 con deep data', 'TIFF multi-layer', 'DPX con alpha'], correctIndex: 1, category: 'vfx', difficulty: 'hard' },
  { text: 'Cosa significa ACES nel color management?', options: ['Advanced Color Enhancement System', 'Academy Color Encoding System', 'Automated Color Editing Software', 'Adaptive Chrominance Equalization Standard'], correctIndex: 1, category: 'vfx', difficulty: 'hard' },
  { text: 'In una pipeline VFX, cosa fa un IDT (Input Device Transform) in ACES?', options: ['Converte i dati del sensore della camera nello spazio ACES', 'Applica la LUT di output', 'Gestisce il render farm', 'Comprime i file EXR'], correctIndex: 0, category: 'vfx', difficulty: 'hard' },
  { text: 'Quale tecnica di rendering usa il "Metropolis Light Transport"?', options: ['Rasterizzazione con shadow maps', 'Path tracing bidirezionale con mutazioni Markov Chain', 'Scanline rendering con ambient occlusion', 'Radiosity con form factors'], correctIndex: 1, category: 'vfx', difficulty: 'hard' },
  { text: 'Nel deep compositing, cosa contiene ogni pixel oltre al colore?', options: ['Solo il canale alpha', 'Campioni multipli di colore e alpha a diverse profondità Z', 'Un vettore normale', 'Coordinate UV'], correctIndex: 1, category: 'vfx', difficulty: 'hard' },
  { text: 'Quale nodo in Nuke è usato per risolvere lens distortion da footage reale?', options: ['Transform', 'LensDistortion (con un modello di distorsione)', 'Reformat', 'CornerPin'], correctIndex: 1, category: 'vfx', difficulty: 'hard' },
  { text: 'Cosa fa un "holdout matte" in compositing?', options: ['Aggiunge glow ai bordi', 'Maschera un oggetto CG dove è occluso da elementi reali', 'Crea motion blur artificiale', 'Genera depth of field'], correctIndex: 1, category: 'vfx', difficulty: 'hard' },
  { text: 'In Arnold, cosa controlla il parametro "camera (AA) samples"?', options: ['Il numero di campioni di anti-aliasing per pixel', 'La risoluzione della camera', 'Il focal length', 'L\'apertura del diaframma'], correctIndex: 0, category: 'vfx', difficulty: 'hard' },
  { text: 'Quale metodo di denoising è integrato in Arnold 6+?', options: ['Intel Open Image Denoise (OIDN)', 'NVIDIA OptiX solo', 'Wavelet threshold', 'Median filter'], correctIndex: 0, category: 'vfx', difficulty: 'hard' },

  // ═══════════════════════════════════════════
  // PIPELINE (~58)
  // ═══════════════════════════════════════════

  // --- pipeline easy ---
  { text: 'Cos\'è una "pipeline" nella produzione CG?', options: ['Un cavo di rete', 'Il flusso di lavoro strutturato', 'Un software di rendering', 'Un tipo di texture'], correctIndex: 1, category: 'pipeline', difficulty: 'easy' },
  { text: 'Cosa fa un "render farm"?', options: ['Crea modelli 3D', 'Distribuisce il rendering su molti computer', 'Registra audio', 'Gestisce il color grading'], correctIndex: 1, category: 'pipeline', difficulty: 'easy' },
  { text: 'Quale linguaggio di scripting è il più usato nelle pipeline CG?', options: ['JavaScript', 'Java', 'Python', 'C++'], correctIndex: 2, category: 'pipeline', difficulty: 'easy' },
  { text: 'Cosa significa "asset" in una pipeline CG?', options: ['Il budget', 'Qualsiasi elemento riutilizzabile (modello, texture, rig)', 'Il rendering finale', 'Lo storyboard'], correctIndex: 1, category: 'pipeline', difficulty: 'easy' },
  { text: 'Quale strumento è lo standard per il version control del codice?', options: ['Dropbox', 'Git', 'Google Drive', 'USB'], correctIndex: 1, category: 'pipeline', difficulty: 'easy' },
  { text: 'Quale sistema operativo è più usato nelle pipeline VFX/CG professionali?', options: ['Windows', 'Linux', 'macOS', 'ChromeOS'], correctIndex: 1, category: 'pipeline', difficulty: 'easy' },
  { text: 'Cosa fa un "compositor" nella pipeline?', options: ['Compone musica', 'Combina tutti i layer visivi nel frame finale', 'Modella personaggi', 'Scrive la sceneggiatura'], correctIndex: 1, category: 'pipeline', difficulty: 'easy' },
  { text: 'Quale fase viene dopo il modeling nella pipeline?', options: ['Rendering', 'Texturing/Look Dev', 'Compositing', 'Editing'], correctIndex: 1, category: 'pipeline', difficulty: 'easy' },
  { text: 'Cos\'è il "shot" nella pipeline?', options: ['Una singola inquadratura dall\'inizio al taglio', 'Un intero film', 'Un modello 3D', 'Un effetto sonoro'], correctIndex: 0, category: 'pipeline', difficulty: 'easy' },
  { text: 'Quale strumento di asset management è usato spesso in pipeline?', options: ['Excel', 'ShotGrid (ex Shotgun)', 'PowerPoint', 'Notion'], correctIndex: 1, category: 'pipeline', difficulty: 'easy' },
  { text: 'Cos\'è la "dailies" o "rushes" nella produzione?', options: ['Le riprese giornaliere da revisionare', 'Il pranzo della crew', 'I file temporanei', 'I render test'], correctIndex: 0, category: 'pipeline', difficulty: 'easy' },

  // --- pipeline medium ---
  { text: 'Cosa significa "USD" (Universal Scene Description)?', options: ['United States Dollar', 'Formato Pixar per scene 3D complesse', 'Un tipo di rendering', 'Un codec video'], correctIndex: 1, category: 'pipeline', difficulty: 'medium' },
  { text: 'Cos\'è il "publish" in una pipeline?', options: ['Pubblicare online', 'Salvare una versione approvata di un asset per gli altri reparti', 'Renderizzare il frame finale', 'Esportare il video'], correctIndex: 1, category: 'pipeline', difficulty: 'medium' },
  { text: 'Cos\'è "Alembic" (.abc)?', options: ['Un software di editing', 'Un formato per cache di geometria animata', 'Un tipo di camera', 'Un effetto audio'], correctIndex: 1, category: 'pipeline', difficulty: 'medium' },
  { text: 'Cosa fa un "pipeline TD" (Technical Director)?', options: ['Dirige gli attori', 'Crea e mantiene gli strumenti della pipeline', 'Fa il rendering', 'Monta il film'], correctIndex: 1, category: 'pipeline', difficulty: 'medium' },
  { text: 'Cos\'è OCIO (OpenColorIO)?', options: ['Un codec video', 'Un framework open-source per la gestione del colore', 'Un formato 3D', 'Un software di editing'], correctIndex: 1, category: 'pipeline', difficulty: 'medium' },
  { text: 'Cos\'è il "naming convention" nella pipeline?', options: ['Come si chiamano gli artisti', 'Standard per nominare file e cartelle', 'Un tipo di rendering', 'Un formato video'], correctIndex: 1, category: 'pipeline', difficulty: 'medium' },
  { text: 'Cosa significa "upstream" e "downstream" nella pipeline?', options: ['Flusso dell\'acqua', 'Reparti che forniscono vs ricevono lavoro', 'Velocità di upload/download', 'Tipi di rendering'], correctIndex: 1, category: 'pipeline', difficulty: 'medium' },
  { text: 'Cos\'è un "dependency graph" nella pipeline?', options: ['Un grafico delle dipendenze tra task/asset', 'Un tipo di rendering', 'Un formato file', 'Un effetto audio'], correctIndex: 0, category: 'pipeline', difficulty: 'medium' },
  { text: 'Cos\'è il "bake" nella pipeline?', options: ['Cuocere il pane', 'Convertire dati procedurali in dati fissi (texture, cache)', 'Un tipo di rendering', 'Un effetto di luce'], correctIndex: 1, category: 'pipeline', difficulty: 'medium' },
  { text: 'Cos\'è il "color management" nella pipeline?', options: ['Scegliere i colori preferiti', 'Garantire coerenza colore tra software e output', 'Un tipo di montaggio', 'Un effetto sonoro'], correctIndex: 1, category: 'pipeline', difficulty: 'medium' },
  { text: 'Cos\'è il "turntable" nella pipeline?', options: ['Un giradischi', 'Una rotazione a 360° di un asset per la review', 'Un tipo di camera', 'Un effetto di luce'], correctIndex: 1, category: 'pipeline', difficulty: 'medium' },
  { text: 'Quale API permette di scriptare in Maya?', options: ['MEL e Python', 'JavaScript', 'C# solo', 'Java solo'], correctIndex: 0, category: 'pipeline', difficulty: 'medium' },
  { text: 'Cos\'è un "deadline" software nel contesto pipeline?', options: ['Una scadenza', 'Un software di gestione render farm (Thinkbox Deadline)', 'Un tipo di formato', 'Un effetto VFX'], correctIndex: 1, category: 'pipeline', difficulty: 'medium' },
  { text: 'Cos\'è il "data wrangling" nella pipeline?', options: ['Gestione e organizzazione dei dati di produzione', 'Un tipo di animazione', 'Un effetto VFX', 'Un formato video'], correctIndex: 0, category: 'pipeline', difficulty: 'medium' },
  { text: 'Cos\'è un "look dev" nella pipeline?', options: ['Sviluppo del look/materiali di un asset', 'Sviluppo del layout', 'Revisione del regista', 'Il montaggio finale'], correctIndex: 0, category: 'pipeline', difficulty: 'medium' },

  // --- pipeline hard ---
  { text: 'In USD, cosa fa un "composition arc" di tipo "reference"?', options: ['Collega un asset esterno nella scena mantenendo l\'override locale', 'Cancella tutti i layer', 'Comprime la scena', 'Converte in Alembic'], correctIndex: 0, category: 'pipeline', difficulty: 'hard' },
  { text: 'Quale "composition arc" in USD ha la priorità più alta (LIVRPS)?', options: ['Payload', 'Variant', 'Local opinion', 'Reference'], correctIndex: 2, category: 'pipeline', difficulty: 'hard' },
  { text: 'In una pipeline USD, cosa fa un "payload" rispetto a un "reference"?', options: ['È identico', 'Permette il lazy loading: i dati vengono caricati solo su richiesta', 'Funziona solo con animazioni', 'È deprecato'], correctIndex: 1, category: 'pipeline', difficulty: 'hard' },
  { text: 'Quale framework Python è comunemente usato per costruire pipeline tools con GUI nei VFX?', options: ['Django', 'PySide2/Qt for Python', 'Flask', 'Tkinter solo'], correctIndex: 1, category: 'pipeline', difficulty: 'hard' },
  { text: 'In ShotGrid (Shotgun), cosa rappresenta un "PublishedFile" entity?', options: ['Un file temporaneo', 'Un file versionato approvato e registrato nel database', 'Un backup automatico', 'Un file cancellato'], correctIndex: 1, category: 'pipeline', difficulty: 'hard' },
  { text: 'Quale sistema di scheduling distribuito è comunemente usato per i render farm insieme a Deadline?', options: ['Apache Kafka', 'Tractor (Pixar)', 'Redis solo', 'RabbitMQ solo'], correctIndex: 1, category: 'pipeline', difficulty: 'hard' },
  { text: 'In OCIO, cosa definisce un "display-referred" color space?', options: ['Uno spazio colore lineare della scena', 'Uno spazio colore che rappresenta i valori come appariranno su un display specifico', 'Un formato file', 'Una LUT casuale'], correctIndex: 1, category: 'pipeline', difficulty: 'hard' },
  { text: 'Quale concetto in USD permette di avere varianti multiple di un asset (es. LOD, versioni stagionali)?', options: ['Sublayers', 'VariantSets', 'Payloads', 'Inherits'], correctIndex: 1, category: 'pipeline', difficulty: 'hard' },
  { text: 'Cos\'è il "OTIO" (OpenTimelineIO)?', options: ['Un formato per color management', 'Un formato open-source per lo scambio di timeline editoriali', 'Un render engine', 'Un tool di rigging'], correctIndex: 1, category: 'pipeline', difficulty: 'hard' },
  { text: 'In una pipeline, cos\'è un "context" in Shotgun Toolkit (SGTK)?', options: ['Il background di un dipendente', 'L\'oggetto che identifica dove sta lavorando l\'utente (progetto, shot, task)', 'Un tipo di texture', 'Un formato di rendering'], correctIndex: 1, category: 'pipeline', difficulty: 'hard' },
  { text: 'Quale standard definisce i metadati per la gestione degli asset multimediali nelle pipeline broadcast?', options: ['ACES', 'MXF con OP1a', 'OpenEXR', 'OTIO'], correctIndex: 1, category: 'pipeline', difficulty: 'hard' },

  // ═══════════════════════════════════════════
  // FOTOGRAFIA (~58)
  // ═══════════════════════════════════════════

  // --- fotografia easy ---
  { text: 'Cosa significa "ISO" in fotografia?', options: ['Il formato dell\'immagine', 'La sensibilità del sensore alla luce', 'La velocità dell\'otturatore', 'Il tipo di obiettivo'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },
  { text: 'Quale regola compositiva divide il frame in 9 parti?', options: ['Regola dei quinti', 'Regola dei terzi', 'Regola del centro', 'Regola della metà'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },
  { text: 'Cos\'è il "golden hour" in fotografia?', options: ['L\'ora del pranzo', 'L\'ora dopo l\'alba o prima del tramonto', 'Mezzogiorno', 'La mezzanotte'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },
  { text: 'Cos\'è il formato RAW?', options: ['Un formato compresso', 'I dati grezzi del sensore senza compressione distruttiva', 'Un tipo di JPEG', 'Un formato video'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },
  { text: 'Quale tipo di obiettivo ha una focale molto lunga?', options: ['Grandangolare', 'Fisheye', 'Teleobiettivo', 'Macro'], correctIndex: 2, category: 'fotografia', difficulty: 'easy' },
  { text: 'Cos\'è il "bokeh"?', options: ['Un tipo di obiettivo', 'La qualità della sfocatura dello sfondo', 'Un filtro digitale', 'Un formato RAW'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },
  { text: 'Cosa controlla l\'apertura del diaframma?', options: ['La durata dell\'esposizione', 'La quantità di luce e la profondità di campo', 'La sensibilità del sensore', 'Il bilanciamento del bianco'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },
  { text: 'Cos\'è il "white balance"?', options: ['L\'equilibrio del peso della fotocamera', 'La regolazione dei toni per rendere il bianco neutro', 'Un tipo di flash', 'Un formato immagine'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },
  { text: 'Cosa significa "sovraesporre" una foto?', options: ['Troppa poca luce', 'Troppa luce, immagine troppo chiara', 'Colori sbagliati', 'Messa a fuoco errata'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },
  { text: 'Quale software è lo standard per l\'editing fotografico?', options: ['Paint', 'Adobe Lightroom/Photoshop', 'GIMP solo', 'Canva'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },
  { text: 'Cos\'è un "mirrorless"?', options: ['Un obiettivo senza vetro', 'Una fotocamera senza specchio reflex', 'Un tipo di flash', 'Un formato di stampa'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },
  { text: 'Quale fotografo è famoso per i paesaggi in bianco e nero?', options: ['Ansel Adams', 'Steve McCurry', 'Annie Leibovitz', 'Richard Avedon'], correctIndex: 0, category: 'fotografia', difficulty: 'easy' },
  { text: 'Cos\'è il "noise" in fotografia digitale?', options: ['Il rumore dell\'otturatore', 'Grana/disturbo visivo causato da ISO alti', 'Un tipo di filtro', 'Un formato file'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },

  // --- fotografia medium ---
  { text: 'Cosa significa f/1.4?', options: ['Focale di 1.4mm', 'Apertura molto ampia (molta luce)', 'Tempo di esposizione di 1.4s', 'ISO 1.4'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Cos\'è il "crop factor"?', options: ['Ritagliare una foto', 'Il rapporto tra sensore piccolo e full frame', 'Un tipo di obiettivo', 'Un formato di stampa'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Cosa significa "full frame" per un sensore?', options: ['Un sensore piccolo', 'Un sensore della stessa dimensione della pellicola 35mm', 'Un sensore per video', 'Un tipo di obiettivo'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Chi ha scattato la famosa foto "Afghan Girl"?', options: ['Ansel Adams', 'Steve McCurry', 'Henri Cartier-Bresson', 'Robert Capa'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Cos\'è il "bracketing" in fotografia?', options: ['Un tipo di inquadratura', 'Scattare più foto con esposizioni diverse', 'Un tipo di obiettivo', 'Una tecnica di ritocco'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Cosa fa un filtro ND (Neutral Density)?', options: ['Aggiunge colore', 'Riduce la luce senza alterare i colori', 'Aumenta il contrasto', 'Sfoca lo sfondo'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Cos\'è il "chromatic aberration"?', options: ['Un effetto desiderato', 'Frange colorate ai bordi causate dalla lente', 'Un filtro', 'Un tipo di flash'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Cosa significa "stop" in fotografia?', options: ['Fermarsi', 'Un raddoppio o dimezzamento della luce', 'Un tipo di obiettivo', 'Una tecnica di scatto'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Cos\'è il "dynamic range" in fotografia?', options: ['La gamma di movimenti', 'La gamma tra il punto più scuro e più chiaro catturabile', 'Un tipo di zoom', 'Un formato video'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Cos\'è il "focus stacking"?', options: ['Impilare obiettivi', 'Combinare foto con fuoco diverso per avere tutto a fuoco', 'Un tipo di zoom', 'Una tecnica di esposizione'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Quale rapporto d\'aspetto è lo standard per le foto 35mm?', options: ['16:9', '3:2', '4:3', '1:1'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Quale metodo di metering misura la luce su tutto il frame?', options: ['Spot', 'Matrix/Evaluative', 'Center-weighted', 'Partial'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Cos\'è il "tilt-shift"?', options: ['Muovere la camera', 'Obiettivo che bascula e decentra per controllare prospettiva e fuoco', 'Un tipo di zoom', 'Un filtro Instagram'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Quale obiettivo è considerato il più simile all\'angolo di campo dell\'occhio umano?', options: ['24mm', '35mm', '50mm', '85mm'], correctIndex: 2, category: 'fotografia', difficulty: 'medium' },
  { text: 'Cos\'è la "vignettatura"?', options: ['Un tipo di stampa', 'Scurimento degli angoli dell\'immagine', 'Un formato file', 'Un effetto sonoro'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Chi è considerato il padre del fotogiornalismo di guerra?', options: ['Ansel Adams', 'Henri Cartier-Bresson', 'Robert Capa', 'Dorothea Lange'], correctIndex: 2, category: 'fotografia', difficulty: 'medium' },
  { text: 'Cosa significa "back button focus"?', options: ['Mettere a fuoco con un pulsante posteriore invece del grilletto', 'Un obiettivo speciale', 'Un tipo di autofocus', 'Una modalità di scatto'], correctIndex: 0, category: 'fotografia', difficulty: 'medium' },

  // --- fotografia hard ---
  { text: 'Quale formula calcola la profondità di campo iperfocale?', options: ['H = f + N*C', 'H = f²/(N*c) + f', 'H = f/N', 'H = N*c*f'], correctIndex: 1, category: 'fotografia', difficulty: 'hard' },
  { text: 'Quale curva descrive la risposta tonale di una pellicola analogica?', options: ['Curva di Bézier', 'Curva caratteristica (D-log H / Hurter-Driffield)', 'Curva gaussiana', 'Curva di Planck'], correctIndex: 1, category: 'fotografia', difficulty: 'hard' },
  { text: 'In un sensore CMOS, cos\'è il "rolling shutter" e quando causa problemi?', options: ['Otturatore globale lento', 'Lettura sequenziale delle righe che distorce soggetti in movimento', 'Vibrazioni del sensore', 'Rumore termico ad alti ISO'], correctIndex: 1, category: 'fotografia', difficulty: 'hard' },
  { text: 'Quale tipo di pattern utilizza il sensore Bayer per catturare il colore?', options: ['RGBW in righe alternate', 'RGGB con il doppio dei fotositi verdi', 'RGB ugualmente distribuito', 'CMY a strisce'], correctIndex: 1, category: 'fotografia', difficulty: 'hard' },
  { text: 'Cosa misura l\'MTF (Modulation Transfer Function) di un obiettivo?', options: ['La velocità dell\'autofocus', 'La capacità di riprodurre il contrasto a diverse frequenze spaziali', 'La distorsione geometrica', 'La trasmissione della luce totale'], correctIndex: 1, category: 'fotografia', difficulty: 'hard' },
  { text: 'Quale fenomeno ottico causa i "sunstar" nelle foto con diaframma chiuso?', options: ['Rifrazione atmosferica', 'Diffrazione ai bordi delle lamelle del diaframma', 'Lens flare interno', 'Aberrazione sferica'], correctIndex: 1, category: 'fotografia', difficulty: 'hard' },
  { text: 'In quale anno è stato introdotto il primo sensore full-frame CMOS in una DSLR commerciale?', options: ['1999 (Nikon D1)', '2002 (Canon EOS-1Ds)', '2005 (Canon 5D)', '2008 (Nikon D700)'], correctIndex: 1, category: 'fotografia', difficulty: 'hard' },
  { text: 'Cos\'è il "circle of confusion" (CoC) e perché è importante?', options: ['Un difetto dell\'obiettivo', 'Il diametro massimo di un punto sfocato percepito come nitido, determina la profondità di campo', 'Una misura della distorsione', 'Il diametro della pupilla d\'entrata'], correctIndex: 1, category: 'fotografia', difficulty: 'hard' },
  { text: 'Quale sistema di esposizione zonale ha sviluppato Ansel Adams?', options: ['Sistema a 5 zone', 'Sistema a 10 zone (0-IX)', 'Sistema a 15 zone', 'Sistema a 3 zone'], correctIndex: 1, category: 'fotografia', difficulty: 'hard' },

  // ═══════════════════════════════════════════
  // CITAZIONI (~54)
  // ═══════════════════════════════════════════

  // --- citazioni easy ---
  { text: '"Che la Forza sia con te" — da quale film?', options: ['Star Trek', 'Star Wars', 'Il Signore degli Anelli', 'Harry Potter'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Sarò di ritorno" (I\'ll be back) — quale film?', options: ['Rambo', 'Terminator', 'Predator', 'Die Hard'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Houston, abbiamo un problema" — quale film?', options: ['Gravity', 'Apollo 13', 'Interstellar', 'The Martian'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"La vita è come una scatola di cioccolatini" — quale film?', options: ['Rain Man', 'Forrest Gump', 'Cast Away', 'The Terminal'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Io sono Groot" — quale film?', options: ['Avatar', 'Guardiani della Galassia', 'Star Wars', 'Transformers'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Sono il re del mondo!" — quale film?', options: ['Il Gladiatore', 'Titanic', 'Braveheart', 'Troy'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Fino all\'infinito e oltre!" — quale personaggio?', options: ['Woody', 'Buzz Lightyear', 'Rex', 'Slinky'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Io sono tuo padre" — chi lo dice?', options: ['Obi-Wan Kenobi', 'Darth Vader', 'Yoda', 'Palpatine'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Non puoi passare!" (You shall not pass!) — chi lo dice?', options: ['Aragorn', 'Gandalf', 'Saruman', 'Elrond'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Vedo gente morta" — quale film?', options: ['Shining', 'Il Sesto Senso', 'The Others', 'Ghost'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Il mio tesoro!" (My precious!) — quale personaggio?', options: ['Frodo', 'Gollum', 'Sauron', 'Gandalf'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Hakuna Matata" significa "nessun pensiero" in quale lingua?', options: ['Zulu', 'Swahili', 'Yoruba', 'Amharic'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Non esiste il cucchiaio" — quale film?', options: ['Inception', 'The Matrix', 'Doctor Strange', 'Tenet'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Shaken, not stirred" — quale personaggio?', options: ['Ethan Hunt', 'James Bond', 'Jason Bourne', 'Jack Ryan'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Fai o non fai. Non c\'è provare." — chi lo dice?', options: ['Obi-Wan', 'Yoda', 'Mace Windu', 'Qui-Gon'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },

  // --- citazioni medium ---
  { text: '"Gli farò un\'offerta che non potrà rifiutare" — quale film?', options: ['Scarface', 'Il Padrino', 'Goodfellas', 'Casino'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"Perché siamo così seri?" (Why so serious?) — quale personaggio?', options: ['Bane', 'Joker (Heath Ledger)', 'Riddler', 'Pinguino'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"Dopo tutto, domani è un altro giorno" — quale film?', options: ['Il Padrino', 'Via col Vento', 'Casablanca', 'Colazione da Tiffany'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"Io sono inevitabile" — quale personaggio?', options: ['Loki', 'Thanos', 'Ultron', 'Dormammu'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"La prima regola del Fight Club è..." — completa', options: ['Combattere sempre', 'Non parlare del Fight Club', 'Vincere sempre', 'Non perdere mai'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"Keep your friends close, but your enemies closer" — da?', options: ['Il Padrino - Parte II', 'Scarface', 'The Departed', 'Casino'], correctIndex: 0, category: 'citazioni', difficulty: 'medium' },
  { text: '"Essere o non essere" — da quale opera di Shakespeare?', options: ['Re Lear', 'Amleto', 'Otello', 'La Tempesta'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"Il dado è tratto" — chi lo disse?', options: ['Nerone', 'Giulio Cesare', 'Augusto', 'Marco Antonio'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"Cogito ergo sum" (Penso dunque sono) — chi?', options: ['Platone', 'Cartesio', 'Kant', 'Hegel'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"Sii il cambiamento che vuoi vedere nel mondo" — chi?', options: ['Nelson Mandela', 'Gandhi', 'Martin Luther King', 'Madre Teresa'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"La semplicità è la sofisticazione suprema" — chi?', options: ['Steve Jobs', 'Leonardo da Vinci', 'Albert Einstein', 'Michelangelo'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"Arrivederci" — in quale film di Tarantino è una battuta chiave detta da Hans Landa?', options: ['Kill Bill', 'Inglourious Basterds', 'Pulp Fiction', 'Django Unchained'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"Toto, non siamo più in Kansas" — quale film?', options: ['Alice nel Paese delle Meraviglie', 'Il Mago di Oz', 'Peter Pan', 'La Storia Infinita'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"Voglio fare un gioco" — quale saga horror?', options: ['Scream', 'Saw', 'Final Destination', 'Halloween'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"It\'s a trap!" — chi lo dice in Star Wars?', options: ['Han Solo', 'Ammiraglio Ackbar', 'Lando', 'C-3PO'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },

  // --- citazioni hard ---
  { text: '"Rosebud" è la parola chiave di quale film del 1941?', options: ['Casablanca', 'Citizen Kane', 'Il Mistero del Falco', 'Gilda'], correctIndex: 1, category: 'citazioni', difficulty: 'hard' },
  { text: '"Stasera si recita a soggetto" — di chi è l\'opera teatrale?', options: ['Goldoni', 'Pirandello', 'De Filippo', 'Fo'], correctIndex: 1, category: 'citazioni', difficulty: 'hard' },
  { text: '"Stellaaaa!" — in quale film del 1951 Marlon Brando urla questa battuta?', options: ['Fronte del porto', 'Un Tram Chiamato Desiderio', 'Il Padrino', 'Viva Zapata!'], correctIndex: 1, category: 'citazioni', difficulty: 'hard' },
  { text: '"Quel che è fatto è fatto" (What\'s done is done) — in quale opera di Shakespeare appare?', options: ['Romeo e Giulietta', 'Macbeth', 'Amleto', 'Otello'], correctIndex: 1, category: 'citazioni', difficulty: 'hard' },
  { text: '"Forget it, Jake. It\'s Chinatown." — in quale film del 1974?', options: ['The Conversation', 'Chinatown', 'Serpico', 'The Parallax View'], correctIndex: 1, category: 'citazioni', difficulty: 'hard' },
  { text: '"Che tu possa vivere in tempi interessanti" — qual è la vera origine di questa frase?', options: ['Antico proverbio cinese documentato', 'Attribuzione occidentale errata, non ha origine cinese verificata', 'Detto romano tradotto', 'Citazione di Confucio'], correctIndex: 1, category: 'citazioni', difficulty: 'hard' },
  { text: '"I love the smell of napalm in the morning" — chi lo dice in Apocalypse Now?', options: ['Captain Willard (Sheen)', 'Colonnello Kilgore (Duvall)', 'Chef (Forrest)', 'Clean (Fishburne)'], correctIndex: 1, category: 'citazioni', difficulty: 'hard' },
  { text: '"Ogni cosa che puoi immaginare, la natura l\'ha già creata" — chi?', options: ['Da Vinci', 'Einstein', 'Newton', 'Galileo'], correctIndex: 0, category: 'citazioni', difficulty: 'hard' },
  { text: '"A me gli occhi, please" è il titolo di uno spettacolo di quale artista italiano?', options: ['Dario Fo', 'Gigi Proietti', 'Totò', 'Alberto Sordi'], correctIndex: 1, category: 'citazioni', difficulty: 'hard' },
  { text: '"Avada Kedavra" in Harry Potter ha un\'etimologia che deriva da quale lingua?', options: ['Latino classico', 'Aramaico (abracadabra)', 'Greco antico', 'Sanscrito'], correctIndex: 1, category: 'citazioni', difficulty: 'hard' },

  // ═══════════════════════════════════════════
  // GENERALE (~56)
  // ═══════════════════════════════════════════

  // --- generale easy ---
  { text: 'Cosa significa "FPS"?', options: ['Frames Per Second', 'Files Per System', 'Format Per Screen', 'Full Pixel Size'], correctIndex: 0, category: 'generale', difficulty: 'easy' },
  { text: 'Quale azienda produce le GPU della serie RTX?', options: ['AMD', 'Intel', 'NVIDIA', 'Apple'], correctIndex: 2, category: 'generale', difficulty: 'easy' },
  { text: 'Quale risoluzione è il "4K"?', options: ['2560x1440', '1920x1080', '3840x2160', '7680x4320'], correctIndex: 2, category: 'generale', difficulty: 'easy' },
  { text: 'Quale risoluzione è "Full HD"?', options: ['1280x720', '1920x1080', '2560x1440', '3840x2160'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Cos\'è la "GPU"?', options: ['General Processing Unit', 'Graphics Processing Unit', 'Global Pixel Utility', 'Graphic Program Update'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Quale formato supporta la trasparenza (canale alpha)?', options: ['JPEG', 'PNG', 'BMP', 'MP3'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Quale azienda ha creato Photoshop?', options: ['Microsoft', 'Adobe', 'Apple', 'Google'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Quale azienda ha creato l\'iPhone?', options: ['Samsung', 'Apple', 'Google', 'Microsoft'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Cos\'è il "color grading"?', options: ['Classificare i colori', 'Correzione e stilizzazione del colore in post-produzione', 'Dipingere texture', 'Calibrare un monitor'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Quale software Adobe è lo standard per il montaggio video?', options: ['Photoshop', 'Premiere Pro', 'Illustrator', 'InDesign'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Cos\'è la "realtà aumentata" (AR)?', options: ['Un videogioco', 'Sovrapporre elementi digitali al mondo reale', 'Un tipo di cinema', 'Un formato video'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Quale colore si ottiene mischiando rosso e blu (luce additiva)?', options: ['Verde', 'Giallo', 'Magenta', 'Ciano'], correctIndex: 2, category: 'generale', difficulty: 'easy' },
  { text: 'Cos\'è un "render" nel contesto CG?', options: ['Un disegno a mano', 'Il processo di generare l\'immagine finale da dati 3D', 'Un tipo di modello', 'Un formato file'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Quale tecnologia di display ha pixel auto-emissivi?', options: ['LCD', 'OLED', 'LED', 'Plasma'], correctIndex: 1, category: 'generale', difficulty: 'easy' },

  // --- generale medium ---
  { text: 'Cos\'è il "ray tracing"?', options: ['Un tipo di animazione', 'Una tecnica di rendering che simula il percorso dei raggi di luce', 'Un formato video', 'Uno strumento di editing'], correctIndex: 1, category: 'generale', difficulty: 'medium' },
  { text: 'Cosa sono gli "shader"?', options: ['Programmi che determinano l\'aspetto delle superfici nel rendering', 'Telecamere virtuali', 'Microfoni digitali', 'Cavi di connessione'], correctIndex: 0, category: 'generale', difficulty: 'medium' },
  { text: 'Cos\'è il "PBR" (Physically Based Rendering)?', options: ['Un formato file', 'Rendering che simula le proprietà fisiche reali dei materiali', 'Un tipo di camera', 'Un effetto sonoro'], correctIndex: 1, category: 'generale', difficulty: 'medium' },
  { text: 'Quale codec video è lo standard per la distribuzione online?', options: ['ProRes', 'H.264/H.265', 'DNxHR', 'AVI'], correctIndex: 1, category: 'generale', difficulty: 'medium' },
  { text: 'Cos\'è il "bit depth" di un\'immagine?', options: ['La dimensione in pixel', 'Il numero di bit per canale colore', 'Il peso del file', 'La risoluzione dello schermo'], correctIndex: 1, category: 'generale', difficulty: 'medium' },
  { text: 'Cos\'è il modello colore "CMYK"?', options: ['Per schermi digitali', 'Per la stampa (Cyan, Magenta, Yellow, Key/Black)', 'Per il video', 'Per l\'audio'], correctIndex: 1, category: 'generale', difficulty: 'medium' },
  { text: 'Quale formato audio è senza perdita (lossless)?', options: ['MP3', 'AAC', 'WAV/FLAC', 'OGG'], correctIndex: 2, category: 'generale', difficulty: 'medium' },
  { text: 'Cos\'è un "codec"?', options: ['Un tipo di cavo', 'Un algoritmo che comprime/decomprime dati audio/video', 'Un formato di stampa', 'Un tipo di monitor'], correctIndex: 1, category: 'generale', difficulty: 'medium' },
  { text: 'Cos\'è la "rasterizzazione"?', options: ['Convertire grafica vettoriale in pixel', 'Un tipo di stampa', 'Un effetto audio', 'Un formato video'], correctIndex: 0, category: 'generale', difficulty: 'medium' },
  { text: 'Cos\'è il "vector graphics"?', options: ['Grafica basata su formule matematiche, scalabile senza perdita', 'Grafica basata su pixel', 'Un tipo di video', 'Un formato audio'], correctIndex: 0, category: 'generale', difficulty: 'medium' },
  { text: 'Quale standard definisce i colori per il web?', options: ['CMYK', 'sRGB', 'Adobe RGB', 'DCI-P3'], correctIndex: 1, category: 'generale', difficulty: 'medium' },
  { text: 'Cos\'è l\'"anti-aliasing"?', options: ['Un tipo di virus', 'Tecnica per ridurre i bordi a scaletta nelle immagini digitali', 'Un formato file', 'Un tipo di compressione'], correctIndex: 1, category: 'generale', difficulty: 'medium' },
  { text: 'Quale aspect ratio è il "cinemascope"?', options: ['16:9', '4:3', '2.39:1', '1:1'], correctIndex: 2, category: 'generale', difficulty: 'medium' },
  { text: 'Quale formato video è senza perdita qualitativa?', options: ['MP4 H.264', 'ProRes 4444', 'H.265', 'WebM'], correctIndex: 1, category: 'generale', difficulty: 'medium' },
  { text: 'Cos\'è un "proxy" nel workflow video?', options: ['Un file a bassa risoluzione per editing più veloce', 'Un tipo di codec', 'Una telecamera', 'Un formato audio'], correctIndex: 0, category: 'generale', difficulty: 'medium' },
  { text: 'Quale sistema numerico usa base 16?', options: ['Binario', 'Ottale', 'Esadecimale', 'Decimale'], correctIndex: 2, category: 'generale', difficulty: 'medium' },
  { text: 'Cos\'è la "VRAM"?', options: ['Memoria video dedicata della GPU', 'Memoria virtuale del browser', 'Un tipo di storage', 'Un formato file'], correctIndex: 0, category: 'generale', difficulty: 'medium' },

  // --- generale hard ---
  { text: 'Quale algoritmo di compressione video usa H.265/HEVC che lo rende più efficiente di H.264?', options: ['DCT con blocchi fissi 4x4', 'CTU (Coding Tree Units) fino a 64x64 con partizionamento ricorsivo', 'Wavelet transform come JPEG 2000', 'Fractal compression'], correctIndex: 1, category: 'generale', difficulty: 'hard' },
  { text: 'In un\'immagine a 16 bit per canale, quanti livelli di intensità sono possibili per canale?', options: ['256', '1024', '65536', '16777216'], correctIndex: 2, category: 'generale', difficulty: 'hard' },
  { text: 'Quale spazio colore copre la gamma più ampia tra questi?', options: ['sRGB', 'Adobe RGB', 'DCI-P3', 'Rec. 2020'], correctIndex: 3, category: 'generale', difficulty: 'hard' },
  { text: 'Cosa definisce la legge di Nyquist-Shannon per il campionamento audio?', options: ['Il volume massimo', 'La frequenza di campionamento deve essere almeno il doppio della frequenza massima', 'Il numero di canali', 'La profondità in bit'], correctIndex: 1, category: 'generale', difficulty: 'hard' },
  { text: 'Quale tipo di anti-aliasing usa il temporal reprojection per ridurre l\'aliasing?', options: ['MSAA', 'FXAA', 'TAA (Temporal Anti-Aliasing)', 'SSAA'], correctIndex: 2, category: 'generale', difficulty: 'hard' },
  { text: 'In GPU computing, cosa sono i "CUDA cores" di NVIDIA?', options: ['Core per l\'audio', 'Unità di calcolo parallelo per operazioni floating-point', 'Cache di memoria', 'Transistor di controllo'], correctIndex: 1, category: 'generale', difficulty: 'hard' },
  { text: 'Quale standard HDR per display definisce il mastering a 10.000 nits come riferimento?', options: ['HDR10', 'Dolby Vision', 'HLG', 'ACES (la scena riferimento è illimitata, il display PQ ST.2084)'], correctIndex: 3, category: 'generale', difficulty: 'hard' },
  { text: 'Quale transfer function è usata in Rec. 709 per la codifica del segnale video?', options: ['Lineare', 'Gamma 2.2 approssimata (BT.1886 per display)', 'PQ (Perceptual Quantizer)', 'HLG'], correctIndex: 1, category: 'generale', difficulty: 'hard' },
  { text: 'Cos\'è il "subpixel rendering" usato nei display LCD?', options: ['Rendering sotto la risoluzione nativa', 'Sfruttare i sub-pixel RGB individuali per aumentare la risoluzione apparente del testo', 'Un tipo di anti-aliasing 3D', 'Compressione video per streaming'], correctIndex: 1, category: 'generale', difficulty: 'hard' },
  { text: 'Quale differenza chiave c\'è tra "scene-referred" e "display-referred" nel color management?', options: ['Nessuna differenza', 'Scene-referred rappresenta valori di luce lineari della scena, display-referred i valori finali per lo schermo', 'Display-referred è solo per stampanti', 'Scene-referred è compresso, display-referred è lineare'], correctIndex: 1, category: 'generale', difficulty: 'hard' },

  // ═══════════════════════════════════════════
  // ADDITIONAL QUESTIONS TO REACH ~400
  // ═══════════════════════════════════════════

  // --- cinema easy (additional) ---
  { text: 'Quale film ha T-800 come personaggio?', options: ['RoboCop', 'Terminator', 'Blade Runner', 'Total Recall'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'In che anno è uscito "Titanic" di James Cameron?', options: ['1995', '1997', '1999', '2001'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Quanti film compongono la saga "Il Signore degli Anelli" (trilogia originale)?', options: ['2', '3', '4', '5'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Quale film ha come protagonista un panda che fa kung fu?', options: ['Kung Fu Hustle', 'Kung Fu Panda', 'Mulan', 'Spirit'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Quale film ha un anello come oggetto centrale della trama?', options: ['Harry Potter', 'Il Signore degli Anelli', 'Le Cronache di Narnia', 'Eragon'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'In "Shining", quale attore interpreta Jack Torrance?', options: ['Robert De Niro', 'Jack Nicholson', 'Al Pacino', 'Dustin Hoffman'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'In "Gravity", quale attrice è la protagonista?', options: ['Anne Hathaway', 'Sandra Bullock', 'Natalie Portman', 'Jessica Chastain'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },
  { text: 'Chi ha diretto "Oppenheimer" (2023)?', options: ['Denis Villeneuve', 'Christopher Nolan', 'Martin Scorsese', 'Ridley Scott'], correctIndex: 1, category: 'cinema', difficulty: 'easy' },

  // --- cinema medium (additional) ---
  { text: 'In "Apocalypse Now", in quale guerra è ambientato?', options: ['WWII', 'Vietnam', 'Corea', 'Iraq'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'In "Scarface", chi è l\'attore protagonista?', options: ['Robert De Niro', 'Al Pacino', 'Joe Pesci', 'Ray Liotta'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'Quale film di Tarantino è ambientato durante la Seconda Guerra Mondiale?', options: ['Kill Bill', 'Inglourious Basterds', 'Django Unchained', 'Pulp Fiction'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'In "Joker" (2019), chi interpreta Arthur Fleck?', options: ['Jared Leto', 'Joaquin Phoenix', 'Heath Ledger', 'Jack Nicholson'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'In quale film appare la frase "Io sono tuo padre"?', options: ['Star Wars: Una Nuova Speranza', 'Star Wars: L\'Impero Colpisce Ancora', 'Star Wars: Il Ritorno dello Jedi', 'Star Wars: La Minaccia Fantasma'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },
  { text: 'In "Il Gladiatore", chi interpreta Massimo Decimo Meridio?', options: ['Brad Pitt', 'Russell Crowe', 'Gerard Butler', 'Joaquin Phoenix'], correctIndex: 1, category: 'cinema', difficulty: 'medium' },

  // --- cinema hard (additional) ---
  { text: 'Quale pellicola del 1929 è il primo film a vincere l\'Oscar come Miglior Film?', options: ['Sunrise', 'Wings', 'The Broadway Melody', 'All Quiet on the Western Front'], correctIndex: 2, category: 'cinema', difficulty: 'hard' },
  { text: 'In "2001: Odissea nello Spazio", come si chiama l\'intelligenza artificiale?', options: ['WOPR', 'HAL 9000', 'TARS', 'Skynet'], correctIndex: 1, category: 'cinema', difficulty: 'hard' },
  { text: 'Quale tecnica di proiezione usa un rapporto anamorfico 2x per il Cinemascope?', options: ['Lente cilindrica anamorfica che comprime orizzontalmente', 'Due proiettori sincronizzati', 'Pellicola 70mm standard', 'Specchio parabolico'], correctIndex: 0, category: 'cinema', difficulty: 'hard' },
  { text: 'Quale direttore della fotografia ha girato "1917" di Sam Mendes simulando un unico piano sequenza?', options: ['Hoyte van Hoytema', 'Roger Deakins', 'Emmanuel Lubezki', 'Bradford Young'], correctIndex: 1, category: 'cinema', difficulty: 'hard' },
  { text: 'Quale film del 1982 è stato un flop al botteghino ma è diventato un cult per il "Director\'s Cut"?', options: ['The Thing', 'Blade Runner', 'Tron', 'Dark Crystal'], correctIndex: 1, category: 'cinema', difficulty: 'hard' },

  // --- animazione easy (additional) ---
  { text: 'Quale film animato ha uno stile "painterly" unico con frame misti?', options: ['Coco', 'Spider-Man: Into the Spider-Verse', 'Soul', 'Luca'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },
  { text: 'Quale film Disney/Pixar ha i giocattoli come protagonisti?', options: ['Cars', 'Toy Story', 'Monsters Inc.', 'Bug\'s Life'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },
  { text: 'Quale film animato ha un mondo dentro le emozioni?', options: ['Soul', 'Inside Out', 'Coco', 'Turning Red'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },
  { text: 'Quale studio ha creato "Puss in Boots: The Last Wish"?', options: ['Pixar', 'DreamWorks', 'Illumination', 'Sony'], correctIndex: 1, category: 'animazione', difficulty: 'easy' },

  // --- animazione medium (additional) ---
  { text: 'Cos\'è il "cloth simulation"?', options: ['Simulazione del tessuto/vestiti su personaggi', 'Un tipo di texture', 'Un effetto di luce', 'Un tipo di rendering'], correctIndex: 0, category: 'animazione', difficulty: 'medium' },
  { text: 'Cos\'è il "lip sync"?', options: ['Sincronizzazione labiale con l\'audio', 'Un effetto sonoro', 'Un tipo di montaggio', 'Un filtro vocale'], correctIndex: 0, category: 'animazione', difficulty: 'medium' },
  { text: 'Cos\'è il "walk cycle"?', options: ['Un percorso della camera', 'Un\'animazione ciclica della camminata', 'Un ciclo di rendering', 'Un effetto particellare'], correctIndex: 1, category: 'animazione', difficulty: 'medium' },
  { text: 'Quale principio di animazione riguarda il percorso curvo del movimento?', options: ['Staging', 'Arcs', 'Timing', 'Pose to Pose'], correctIndex: 1, category: 'animazione', difficulty: 'medium' },
  { text: 'Quale film ha vinto l\'Oscar come primo lungometraggio animato (categoria Best Animated Feature)?', options: ['Toy Story', 'Shrek', 'Alla Ricerca di Nemo', 'Monsters Inc.'], correctIndex: 1, category: 'animazione', difficulty: 'medium' },

  // --- animazione hard (additional) ---
  { text: 'Quale tecnica di rendering ha usato Pixar per i capelli di Merida in "Brave"?', options: ['Hair cards poligonali', 'Simulazione curve con il solver proprietario e rendering con RenderMan', 'Texture map su cilindri', 'Sprite billboards'], correctIndex: 1, category: 'animazione', difficulty: 'hard' },
  { text: 'In Maya, quale tipo di deformer è usato per simulare muscoli sotto la pelle?', options: ['Lattice', 'Muscle system (cMuscle)', 'Wire deformer', 'Wrap deformer'], correctIndex: 1, category: 'animazione', difficulty: 'hard' },
  { text: 'Quale formato open-source è stato sviluppato da Pixar per la descrizione di scene 3D complesse?', options: ['Alembic', 'USD (Universal Scene Description)', 'FBX', 'glTF'], correctIndex: 1, category: 'animazione', difficulty: 'hard' },

  // --- vfx easy (additional) ---
  { text: 'Cos\'è il "wire removal"?', options: ['Rimuovere cavi di sicurezza in post-produzione', 'Togliere l\'audio', 'Eliminare frame', 'Un tipo di montaggio'], correctIndex: 0, category: 'vfx', difficulty: 'easy' },
  { text: 'Cos\'è un "clean plate"?', options: ['Un piatto pulito', 'Un frame senza attori/oggetti indesiderati', 'Un tipo di rendering', 'Un formato video'], correctIndex: 1, category: 'vfx', difficulty: 'easy' },
  { text: 'Quale tecnologia permette effetti VFX in tempo reale nei set virtuali?', options: ['Arnold', 'Unreal Engine', 'Nuke', 'Houdini'], correctIndex: 1, category: 'vfx', difficulty: 'easy' },
  { text: 'Cos\'è il "previs" (previsualization)?', options: ['La preview del film con CG a bassa risoluzione', 'Un tipo di rendering finale', 'Un formato video', 'Il trailer del film'], correctIndex: 0, category: 'vfx', difficulty: 'easy' },
  { text: 'Cos\'è la "fluid simulation"?', options: ['Simulazione di liquidi, fumo, fuoco', 'Un tipo di animazione 2D', 'Un effetto audio', 'Un formato file'], correctIndex: 0, category: 'vfx', difficulty: 'easy' },
  { text: 'Cos\'è il "digital double"?', options: ['Due copie di un file', 'Una replica digitale di un attore reale', 'Un tipo di camera', 'Un formato di rendering'], correctIndex: 1, category: 'vfx', difficulty: 'easy' },
  { text: 'Chi ha fondato la ILM (Industrial Light & Magic)?', options: ['Steven Spielberg', 'George Lucas', 'James Cameron', 'Ridley Scott'], correctIndex: 1, category: 'vfx', difficulty: 'easy' },

  // --- vfx medium (additional) ---
  { text: 'Cos\'è il "color space" nei VFX?', options: ['Lo spazio fisico della color room', 'La rappresentazione matematica dei colori', 'Un tipo di lente', 'Una tecnica di montaggio'], correctIndex: 1, category: 'vfx', difficulty: 'medium' },
  { text: 'Quale software è usato per il tracking 3D professionale?', options: ['Photoshop', 'PFTrack / 3DEqualizer', 'Premiere', 'Audacity'], correctIndex: 1, category: 'vfx', difficulty: 'medium' },
  { text: 'Cos\'è il "lens distortion" in VFX?', options: ['Un difetto della lente da replicare nel 3D per il matching', 'Un tipo di filtro audio', 'Un effetto di montaggio', 'Una tecnica di illuminazione'], correctIndex: 0, category: 'vfx', difficulty: 'medium' },
  { text: 'Cos\'è la "face replacement" nei VFX?', options: ['Sostituire il volto di un attore con un altro digitalmente', 'Cambiare il trucco', 'Un effetto di luce', 'Un tipo di montaggio'], correctIndex: 0, category: 'vfx', difficulty: 'medium' },
  { text: 'Quale azienda VFX ha fatto gli effetti di "Gravity" (2013)?', options: ['ILM', 'Weta Digital', 'Framestore', 'Double Negative'], correctIndex: 2, category: 'vfx', difficulty: 'medium' },
  { text: 'Quale tecnica VFX è usata per creare folle digitali?', options: ['Crowd simulation (es. Massive)', 'Chroma key', 'Matte painting', 'Rotoscoping'], correctIndex: 0, category: 'vfx', difficulty: 'medium' },

  // --- vfx hard (additional) ---
  { text: 'In Houdini, quale solver è usato per simulazioni di fumo ad alta risoluzione?', options: ['FLIP solver', 'Pyro solver (basato su griglia voxel)', 'POP solver', 'Wire solver'], correctIndex: 1, category: 'vfx', difficulty: 'hard' },
  { text: 'Quale principio ottico rende il CGI convincente: l\'energia luminosa riflessa non può superare quella ricevuta?', options: ['Legge di Snell', 'Conservazione dell\'energia nel BRDF', 'Effetto Doppler', 'Principio di Fermat'], correctIndex: 1, category: 'vfx', difficulty: 'hard' },
  { text: 'Cosa rappresenta un BRDF (Bidirectional Reflectance Distribution Function)?', options: ['La mappa di profondità', 'La funzione che descrive come la luce viene riflessa da una superficie', 'Un formato file per texture', 'Un tipo di camera virtuale'], correctIndex: 1, category: 'vfx', difficulty: 'hard' },
  { text: 'Quale personaggio CGI è stato tra i primi completamente realistici con performance capture?', options: ['T-Rex di Jurassic Park', 'Gollum di LOTR', 'Jar Jar Binks', 'Davy Jones'], correctIndex: 1, category: 'vfx', difficulty: 'hard' },
  { text: 'In una pipeline VFX, cosa fa un ODT (Output Device Transform) in ACES?', options: ['Converte dalla camera allo spazio ACES', 'Converte dallo spazio ACES allo spazio colore del display/proiettore di output', 'Gestisce il render farm', 'Applica il denoising'], correctIndex: 1, category: 'vfx', difficulty: 'hard' },

  // --- pipeline easy (additional) ---
  { text: 'Cos\'è il "version control" nella pipeline?', options: ['Controllare la velocità', 'Gestire le versioni dei file nel tempo', 'Un tipo di rendering', 'Un formato di esportazione'], correctIndex: 1, category: 'pipeline', difficulty: 'easy' },
  { text: 'Quale formato file è usato per scene 3D universali sviluppato da Pixar?', options: ['.fbx', '.obj', '.usd', '.stl'], correctIndex: 2, category: 'pipeline', difficulty: 'easy' },
  { text: 'Cos\'è il "QC" (Quality Control) nella pipeline?', options: ['Quick Create', 'Verifica qualità del lavoro prima della consegna', 'Un tipo di rendering', 'Un formato file'], correctIndex: 1, category: 'pipeline', difficulty: 'easy' },
  { text: 'Cos\'è la "texture resolution" standard per film?', options: ['512x512', '1024x1024', '4096x4096 (4K)', '256x256'], correctIndex: 2, category: 'pipeline', difficulty: 'easy' },
  { text: 'Quale tool è usato per automatizzare task nella pipeline?', options: ['Photoshop', 'Script Python/Bash', 'Premiere', 'Word'], correctIndex: 1, category: 'pipeline', difficulty: 'easy' },
  { text: 'Cos\'è un "asset library"?', options: ['Una libreria fisica', 'Un database di modelli/texture/materiali riutilizzabili', 'Un tipo di software', 'Un effetto speciale'], correctIndex: 1, category: 'pipeline', difficulty: 'easy' },

  // --- pipeline medium (additional) ---
  { text: 'Quale servizio cloud è usato per render farm professionali?', options: ['Google Docs', 'AWS/Google Cloud', 'Dropbox', 'iCloud'], correctIndex: 1, category: 'pipeline', difficulty: 'medium' },
  { text: 'Cos\'è la fase di "layout" nella pipeline?', options: ['Disegnare la UI', 'Posizionare camera e personaggi nella scena', 'Creare i modelli', 'Fare il compositing'], correctIndex: 1, category: 'pipeline', difficulty: 'medium' },
  { text: 'Quale formato è standard per i materiali PBR?', options: ['.jpg singolo', 'Set di texture maps (baseColor, roughness, metallic, normal)', '.gif', '.bmp'], correctIndex: 1, category: 'pipeline', difficulty: 'medium' },

  // --- pipeline hard (additional) ---
  { text: 'In USD, qual è l\'ordine di risoluzione degli opinion (LIVRPS)?', options: ['Local, Inherit, Variant, Reference, Payload, Sublayer', 'Sublayer, Payload, Reference, Variant, Inherit, Local', 'Reference, Local, Variant, Payload, Sublayer, Inherit', 'Local, Variant, Reference, Sublayer, Inherit, Payload'], correctIndex: 0, category: 'pipeline', difficulty: 'hard' },
  { text: 'Quale tool open-source di Pixar permette di visualizzare e ispezionare scene USD?', options: ['Maya USD plugin', 'usdview', 'Houdini Solaris', 'Katana'], correctIndex: 1, category: 'pipeline', difficulty: 'hard' },
  { text: 'In una pipeline, cosa fa un "resolver" in USD?', options: ['Risolve conflitti di merge', 'Traduce gli asset path logici in percorsi fisici su disco', 'Comprime i file', 'Gestisce le licenze software'], correctIndex: 1, category: 'pipeline', difficulty: 'hard' },

  // --- fotografia easy (additional) ---
  { text: 'Cos\'è il tempo di esposizione?', options: ['Quanto dura l\'apertura dell\'otturatore', 'La dimensione del sensore', 'Il tipo di lente', 'La risoluzione dell\'immagine'], correctIndex: 0, category: 'fotografia', difficulty: 'easy' },
  { text: 'Cosa fa un obiettivo "macro"?', options: ['Fotografa panorami', 'Permette di fotografare soggetti molto piccoli da vicino', 'Aumenta lo zoom', 'Riduce la distorsione'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },
  { text: 'Quale tipo di luce è più morbida per un ritratto?', options: ['Flash diretto', 'Luce diffusa/softbox', 'Controluce', 'Luce spot'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },
  { text: 'Cos\'è un "prime lens" (obiettivo fisso)?', options: ['Un obiettivo zoom', 'Un obiettivo con focale fissa', 'Un obiettivo macro', 'Un filtro'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },
  { text: 'Cos\'è la "profondità di campo"?', options: ['La profondità del soggetto', 'La zona dell\'immagine a fuoco', 'La distanza dalla camera', 'La dimensione del sensore'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },
  { text: 'Quale fotografa è famosa per i ritratti di celebrità?', options: ['Dorothea Lange', 'Annie Leibovitz', 'Vivian Maier', 'Cindy Sherman'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },
  { text: 'Cos\'è l\'"histogram" in fotografia?', options: ['Un tipo di filtro', 'Un grafico che mostra la distribuzione dei toni', 'Un formato file', 'Un tipo di obiettivo'], correctIndex: 1, category: 'fotografia', difficulty: 'easy' },

  // --- fotografia medium (additional) ---
  { text: 'Cos\'è il "panning" in fotografia?', options: ['Una panoramica statica', 'Seguire il soggetto in movimento per sfocatura dinamica dello sfondo', 'Un tipo di zoom', 'Un filtro colore'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Quale formato è preferito per la stampa professionale?', options: ['JPEG', 'TIFF', 'GIF', 'BMP'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Quale tecnica usa tempi lunghi per catturare il movimento (es. cascate setose)?', options: ['Stop motion', 'Long exposure', 'HDR', 'Bracketing'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Cos\'è la "fotografia HDR"?', options: ['Foto ad altissima risoluzione', 'Combinare esposizioni diverse per catturare più gamma dinamica', 'Un tipo di filtro', 'Un formato speciale'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },
  { text: 'Quale tipo di flash rimbalza la luce per un\'illuminazione più morbida?', options: ['Flash diretto', 'Flash bounce', 'Flash ring', 'Flash pop-up'], correctIndex: 1, category: 'fotografia', difficulty: 'medium' },

  // --- fotografia hard (additional) ---
  { text: 'Quale tipo di sensore usa un pattern X-Trans invece del Bayer?', options: ['Sony', 'Canon', 'Fujifilm', 'Nikon'], correctIndex: 2, category: 'fotografia', difficulty: 'hard' },
  { text: 'Cos\'è lo "Scheimpflug principle" usato nelle fotocamere tilt-shift?', options: ['La regola dei terzi in 3D', 'Quando il piano della lente, del soggetto e del sensore convergono in un punto, tutto il piano del soggetto è a fuoco', 'Un tipo di distorsione', 'La legge sulla diffrazione'], correctIndex: 1, category: 'fotografia', difficulty: 'hard' },
  { text: 'Quale fenomeno limita la risoluzione effettiva quando si chiude troppo il diaframma?', options: ['Aberrazione cromatica', 'Diffrazione', 'Vignettatura', 'Coma'], correctIndex: 1, category: 'fotografia', difficulty: 'hard' },

  // --- citazioni easy (additional) ---
  { text: '"E.T. telefono casa" — chi lo dice?', options: ['Elliott', 'E.T.', 'La mamma di Elliott', 'Gertie'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Avada Kedavra" è una maledizione di quale saga?', options: ['Il Signore degli Anelli', 'Harry Potter', 'Le Cronache di Narnia', 'Percy Jackson'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Con grande potere viene grande responsabilità" — da dove?', options: ['Batman', 'Spider-Man', 'Superman', 'X-Men'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Sono Iron Man" — in quale film MCU viene detto per primo?', options: ['Avengers', 'Iron Man', 'Iron Man 2', 'Civil War'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Qui\'s Johnny!" — quale film?', options: ['The Godfather', 'Shining', 'Psycho', 'Misery'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },
  { text: '"Non ci sono incidenti" — quale personaggio animato?', options: ['Yoda', 'Gandalf', 'Maestro Oogway', 'Dumbledore'], correctIndex: 2, category: 'citazioni', difficulty: 'easy' },
  { text: '"Elementare, Watson" — quale personaggio?', options: ['James Bond', 'Sherlock Holmes', 'Hercule Poirot', 'Dr. House'], correctIndex: 1, category: 'citazioni', difficulty: 'easy' },

  // --- citazioni medium (additional) ---
  { text: '"To infinity and beyond!" in che anno è uscito Toy Story?', options: ['1993', '1995', '1997', '1999'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"Buongiorno, Vietnam!" — quale attore lo dice?', options: ['Tom Hanks', 'Robin Williams', 'Bill Murray', 'Jim Carrey'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"La pazienza è la virtù dei forti" — è attribuita a?', options: ['Socrate', 'Aristotele', 'Proverbio popolare', 'Cicerone'], correctIndex: 2, category: 'citazioni', difficulty: 'medium' },
  { text: '"Io sono la legge!" — quale personaggio?', options: ['Batman', 'Judge Dredd', 'RoboCop', 'Terminator'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },
  { text: '"Wendy, sono a casa!" (da Shining) — chi lo dice?', options: ['Danny', 'Jack Torrance', 'Dick Hallorann', 'Grady'], correctIndex: 1, category: 'citazioni', difficulty: 'medium' },

  // --- citazioni hard (additional) ---
  { text: '"Frankly, my dear, I don\'t give a damn" — in quale anno è uscito Via col Vento?', options: ['1936', '1939', '1941', '1943'], correctIndex: 1, category: 'citazioni', difficulty: 'hard' },
  { text: '"Io sono Batman" — quale attore lo ha detto per primo al cinema nel film del 1989?', options: ['Adam West', 'Michael Keaton', 'Val Kilmer', 'George Clooney'], correctIndex: 1, category: 'citazioni', difficulty: 'hard' },
  { text: '"You talking to me?" — in quale anno è uscito Taxi Driver?', options: ['1974', '1976', '1978', '1980'], correctIndex: 1, category: 'citazioni', difficulty: 'hard' },

  // --- generale easy (additional) ---
  { text: 'Cos\'è l\'HDR in un\'immagine?', options: ['High Definition Resolution', 'High Dynamic Range', 'Hyper Digital Render', 'Hard Drive Recovery'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Cos\'è un "SSD" rispetto a un "HDD"?', options: ['Più lento ma più capiente', 'Disco a stato solido, più veloce senza parti meccaniche', 'Un tipo di RAM', 'Un formato file'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Quale linguaggio è usato per le pagine web?', options: ['Python', 'HTML/CSS/JavaScript', 'C++', 'Java'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Cos\'è il "cloud computing"?', options: ['Computer che volano', 'Calcolo e storage su server remoti via internet', 'Un tipo di software', 'Un formato file'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Cos\'è un "plugin"?', options: ['Una spina elettrica', 'Un\'estensione software che aggiunge funzionalità', 'Un tipo di cavo', 'Un formato file'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Quale unità misura la frequenza di aggiornamento di un monitor?', options: ['FPS', 'Hz (Hertz)', 'Mbps', 'dpi'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Cos\'è un "texture" nel contesto 3D?', options: ['La consistenza del tessuto', 'Un\'immagine applicata sulla superficie di un modello 3D', 'Un tipo di luce', 'Un effetto sonoro'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Quale unità misura la risoluzione di stampa?', options: ['PPI', 'DPI', 'FPS', 'Hz'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Cos\'è il "bandwidth"?', options: ['La larghezza del monitor', 'La quantità massima di dati trasferibili in un tempo', 'Un tipo di cavo', 'Un formato file'], correctIndex: 1, category: 'generale', difficulty: 'easy' },
  { text: 'Cos\'è il "latency" nel contesto informatico?', options: ['La velocità di download', 'Il ritardo tra input e risposta', 'La risoluzione dello schermo', 'La capacità di storage'], correctIndex: 1, category: 'generale', difficulty: 'easy' },

  // --- generale medium (additional) ---
  { text: 'Quale è lo standard di campionamento audio CD?', options: ['22.05 kHz', '44.1 kHz', '96 kHz', '192 kHz'], correctIndex: 1, category: 'generale', difficulty: 'medium' },
  { text: 'Quale software è lo standard per l\'editing audio professionale?', options: ['Audacity', 'Pro Tools', 'GarageBand', 'Windows Media Player'], correctIndex: 1, category: 'generale', difficulty: 'medium' },
  { text: 'Quale differenza c\'è tra "lossy" e "lossless"?', options: ['Nessuna', 'Lossy perde dati nella compressione, lossless no', 'Lossless è più pesante sempre', 'Lossy è per audio, lossless per video'], correctIndex: 1, category: 'generale', difficulty: 'medium' },
  { text: 'Cos\'è il "machine learning"?', options: ['Insegnare ai robot a camminare', 'Algoritmi che imparano dai dati senza essere programmati esplicitamente', 'Un tipo di hardware', 'Un linguaggio di programmazione'], correctIndex: 1, category: 'generale', difficulty: 'medium' },
  { text: 'Cos\'è il "frame rate" variabile (VFR)?', options: ['Frame rate che cambia durante il video', 'Un frame rate fisso', 'Un tipo di codec', 'Un formato file'], correctIndex: 0, category: 'generale', difficulty: 'medium' },
  { text: 'Cos\'è la "frequenza di campionamento" audio?', options: ['Quante volte al secondo il suono viene misurato', 'Il volume del suono', 'Il tipo di microfono', 'La durata del file'], correctIndex: 0, category: 'generale', difficulty: 'medium' },
  { text: 'Cos\'è un "aspect ratio"?', options: ['La qualità dell\'immagine', 'Il rapporto tra larghezza e altezza di un\'immagine', 'La dimensione del file', 'Il tipo di compressione'], correctIndex: 1, category: 'generale', difficulty: 'medium' },
  { text: 'Quale porta è la più usata per monitor ad alta risoluzione?', options: ['VGA', 'DVI', 'DisplayPort/HDMI', 'USB-A'], correctIndex: 2, category: 'generale', difficulty: 'medium' },

  // --- generale hard (additional) ---
  { text: 'Quale architettura GPU usa l\'esecuzione SIMT (Single Instruction, Multiple Threads)?', options: ['AMD RDNA solo', 'NVIDIA CUDA (e varianti)', 'Intel Xe solo', 'Apple M-series solo'], correctIndex: 1, category: 'generale', difficulty: 'hard' },
  { text: 'Quale formato file è lo standard IEEE per numeri in virgola mobile a mezza precisione (16 bit)?', options: ['IEEE 754 half-float (binary16)', 'IEEE 754 single (binary32)', 'IEEE 754 double (binary64)', 'BFloat16'], correctIndex: 0, category: 'generale', difficulty: 'hard' },
  { text: 'Quale tecnologia NVIDIA usa core dedicati per accelerare il ray tracing in hardware?', options: ['CUDA cores', 'RT cores', 'Tensor cores', 'Shader cores'], correctIndex: 1, category: 'generale', difficulty: 'hard' },
  { text: 'Quale standard definisce il trasferimento di metadati HDR dinamici frame-by-frame?', options: ['HDR10 (statico)', 'HDR10+ / Dolby Vision (dinamico)', 'HLG', 'sRGB esteso'], correctIndex: 1, category: 'generale', difficulty: 'hard' },
]

export default QUESTIONS
