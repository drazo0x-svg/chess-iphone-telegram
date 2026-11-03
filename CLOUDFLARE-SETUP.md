# Cloudflare relay — Chrome ↔ iPhone (sans ntfy)

Le code du relais se trouve dans `cloudflare/src/index.js`. Il utilise un Worker et un Durable Object SQLite pour transférer les messages **WebSocket** entre le PC et l'iPhone 16 Pro. Stockfish continue à calculer localement dans Safari. Le Worker **ne fait pas le calcul** et ne stocke pas les positions.

## Déploiement Cloudflare depuis GitHub — étape nécessaire

1. Connecte-toi à https://dash.cloudflare.com/ puis ouvre **Workers & Pages → Create → Import a repository** (le nom de l'option peut varier selon l'interface).
2. Autorise Cloudflare à accéder au dépôt `drazo0x-svg/chess-iphone-telegram` et sélectionne-le.
3. Configure le répertoire de travail / root directory sur **`cloudflare`**.
4. Utilise `npm install` pour la préparation si demandé et **`npx wrangler deploy`** comme commande de déploiement. Wrangler lit `cloudflare/wrangler.toml`.
5. Vérifie que le Worker est bien créé avec le Durable Object **ChessRoom** (migration SQLite `v1`). Copie l'URL exacte `https://...workers.dev` affichée par Cloudflare.
6. Teste `https://...workers.dev/health` : la réponse doit contenir `"ok":true`.
7. Ouvre https://drazo0x-svg.github.io/chess-iphone-telegram/ sur Safari. Renseigne l'URL du Worker, génère un canal secret, puis clique **Connecter Cloudflare**.
8. Sur Chrome, récupère la dernière extension depuis https://github.com/drazo0x-svg/chess-iphone-telegram/archive/refs/heads/main.zip ; installe le dossier `extension` avec `chrome://extensions` (mode développeur).
9. Dans l'extension, colle exactement la **même URL HTTPS du Worker** et le **même canal secret**. Utilise le bouton de test de liaison sur un échiquier d'entraînement.

La version Chrome requise est **3.0.1**. Le canal secret est une clé de salle de 32 à 100 caractères, recommandation : 48 caractères hexadécimaux aléatoires (le bouton de la page en génère). Quiconque obtient ce canal ET l'URL du Worker peut rejoindre la salle : **ne partage pas le canal**, n'envoie pas la clé dans des captures publiques.

## Informations techniques

- Le WebSocket reste ouvert pendant la session. Plus de polling HTTP ntfy et plus de blocage provenant des quotas de ntfy.
- WebSocket hibernation gérée par Durable Objects ; le quota gratuit Cloudflare continue à s'appliquer.
- L'iPhone doit garder Safari au premier plan pour calculer.
- Le moteur s'exécute avec les réglages sauvegardés sur l'iPhone : Stockfish 19 Lite + Hash 32 Mio si précédemment sélectionné.
- Si le relais Cloudflare n'est pas déployé, les champs sont présents mais **le service n'est pas opérationnel**.
- Le Worker n'est pas hébergé par GitHub Pages. Sans connexion Cloudflare et déploiement, il est impossible de l'activer à partir du dépôt GitHub seulement.
- Utilisation prévue pour les études de positions, parties terminées, et environnements où l'assistance est autorisée.

## Diagnostic
- Vérifie d'abord `/health` dans un navigateur.
- Safari doit afficher `Relais connecté`.
- Le popup Chrome doit afficher le Worker et le canal communs.
- Le bouton **Tester la liaison PC → iPhone** envoie une FEN connue et attend la réponse sur le même WebSocket.
- Une erreur « iPhone not connected » indique que Safari n'est pas relié à la même salle ou que le Worker est incorrect.
