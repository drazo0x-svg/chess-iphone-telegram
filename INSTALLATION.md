# Analyse échecs : Chrome → iPhone 16 Pro → Chrome (sans Python, sans Telegram)

Le dépôt contient une application Safari qui calcule les coups avec Stockfish 19 Lite sur l'iPhone 16 Pro, et une extension Chrome qui envoie une FEN et reçoit le coup calculé.

## Site iPhone
https://drazo0x-svg.github.io/chess-iphone-telegram/

Le workflow GitHub Actions télécharge automatiquement les fichiers Stockfish lors de chaque déploiement. **Ne pas utiliser Telegram** : aucun token n'est nécessaire.

## Configuration
1. Ouvrir l'adresse ci-dessus dans Safari sur l'iPhone 16 Pro.
2. Appuyer sur **Générer un canal aléatoire**, puis copier tout le canal.
3. Appuyer sur **Démarrer l'écoute**. Garder Safari ouvert au premier plan, écran allumé.
4. Sur le PC, ouvrir `chrome://extensions`, activer **Mode développeur**, **Charger l'extension non empaquetée**, et choisir le dossier `extension` téléchargé depuis ce dépôt.
5. Ouvrir le popup de l'extension et coller le même canal.
6. Sur un échiquier d'entraînement, coller la FEN complète (méthode fiable), ou essayer **Lire les pièces** (expérimental : il faut vérifier couleur au trait, roques et en passant).
7. Cliquer **Calculer sur mon iPhone**, **garder le popup Chrome ouvert** jusqu'au retour du coup.

## Comment ça fonctionne
- Chrome envoie la FEN et un identifiant de requête aléatoire à un canal privé par obscurité sur ntfy.sh.
- Safari écoute ce canal, fait calculer Stockfish localement sur l'iPhone.
- Safari publie le meilleur coup UCI et le score moteur sur le canal de réponse, identifié par la même requête.
- Le popup Chrome affiche le résultat quand il est ouvert.

## Limites
- Un canal ntfy non devinable n'est **pas** une authentification : une personne connaissant le nom pourrait lire ou envoyer les messages. Ne pas utiliser de données sensibles.
- La session fonctionne uniquement tant que Safari reste actif sur l'iPhone ; iOS suspend les onglets en arrière-plan. La fenêtre popup Chrome doit rester ouverte pour afficher la réponse.
- Aucun serveur personnel ni Telegram, aucune installation Python.
- Score UCI exprimé du point de vue du moteur au trait, pas forcément de celui des Blancs.
- Lecture automatique des pièces limitée aux échiquiers DOM compatibles, pas à une capture d'écran (aucun OCR).
- À utiliser pour analyser des parties terminées ou des exercices où les aides extérieures sont autorisées.
