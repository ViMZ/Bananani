# Instructions projet — Bananani

## Livraison des modifications

Sauf si l'utilisateur demande explicitement de conserver une modification en local :

1. Vérifier la modification avec les contrôles adaptés (`git diff --check`, tests ou build si disponibles).
2. Ne jamais inclure dans le commit des changements sans rapport appartenant à l'utilisateur.
3. Créer un commit clair sur la branche `main`, puis pousser vers `origin/main`.
4. Le push déclenche le workflow GitHub Actions `.github/workflows/fly-deploy.yml`.
5. Attendre la fin du déploiement et vérifier qu'une nouvelle release Fly.io est complète avec `fly releases --app bananani` et `fly status --app bananani`.
6. Vérifier que la production répond sur `https://bananani.fly.dev` avant d'annoncer que le travail est terminé.

Si le déploiement automatique ne démarre pas ou échoue, utiliser le fallback documenté dans le README :

```sh
fly deploy --app bananani --remote-only
```

Ne jamais déclarer une modification « déployée » avant d'avoir confirmé la nouvelle release et la réponse HTTP de la production.

## Hébergement

- L'application utilise Fly.io dans la région `cdg`.
- Elle doit conserver exactement une machine, car la base SQLite réside sur un volume local.
- Le scale-to-zero est volontaire : une machine arrêtée après le déploiement n'est pas une erreur si le site redémarre et répond à la première requête.
