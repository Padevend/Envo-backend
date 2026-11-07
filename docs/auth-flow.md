# Parcours d'authentification et d'inscription (cible Phase 3)

Parcours demandé pour le mobile. Il **remplace** le « numéro de téléphone + OTP » du prompt initial : l'identifiant peut être un **e-mail ou un numéro de téléphone**. Pas de mot de passe ; biométrie hors MVP.

## Parcours

1. **Choix de l'identifiant** : l'utilisateur choisit e-mail ou téléphone et le saisit. Le serveur envoie un code de vérification par e-mail ou SMS selon le choix (réponse identique que le compte existe ou non).
2. **Vérification** : l'utilisateur saisit le code. Succès → session ouverte (jetons d'accès et de rafraîchissement liés à l'appareil). La réponse contient `onboardingRequired` et `pinRequired`.
3. **Onboarding** (si `onboardingRequired`) : formulaire adapté — prénom, nom, pays, date de naissance, … ; majorité vérifiée à partir de la date de naissance ; consentements (CGU, confidentialité) horodatés et versionnés.
4. **Création du PIN** : 6 chiffres, saisi deux fois (création + confirmation). Refus des suites, répétitions et motifs triviaux.
5. **Chaque ouverture de l'application** : saisie du PIN pour accéder à la session (voir « Déverrouillage »).
6. **Connexion ultérieure** : appareil connu → PIN seul ; appareil inconnu → code de vérification (e-mail/SMS) puis PIN.

## Signal d'onboarding

Tant que l'onboarding n'est pas validé, **toute route métier** répond `403` avec le code `onboarding_required` (hors routes d'authentification et d'onboarding). La réponse de connexion porte aussi `onboardingRequired: true`, ce qui permet à l'application d'afficher directement le formulaire. Même principe pour `pin_required`. L'application ne montre rien d'autre tant que ces étapes ne sont pas faites.

## Déverrouillage par PIN (proposition)

Le PIN est **vérifié côté serveur** (Argon2id, comparaison à temps constant), jamais seulement localement :

- `POST /v1/auth/pin/unlock` : jeton de rafraîchissement (stocké dans le stockage sécurisé du téléphone) + PIN + signature de la clé d'appareil → nouveau jeton d'accès court (15 min). Sans PIN, le jeton de rafraîchissement seul ne donne pas accès.
- Blocage progressif : 1 min, 5 min, 30 min, puis 24 h avec nouveau code de vérification. Compteurs côté serveur, limiteurs Redis en mode « refus si Redis tombe ».
- Opérations financières : **step-up** (PIN + signature de l'appareil sur le montant et le bénéficiaire), valable une seule fois pendant 60 s.
- Plus tard (hors MVP) : la biométrie débloquera la clé d'appareil localement ; le PIN restera le repli.

## Ports de fournisseurs

Le module `notifications` définit deux interfaces ; aucune logique métier ne connaît un fournisseur :

```ts
interface SmsProvider   { readonly name: string; send(to: string /* E.164 */, text: string, ctx: SendContext): Promise<SendResult> }
interface EmailProvider { readonly name: string; send(to: string, message: { subject: string; text: string; html?: string }, ctx: SendContext): Promise<SendResult> }
```

- Plusieurs implémentations possibles, choisies par configuration (`SMS_PROVIDERS=a,b`, `EMAIL_PROVIDERS=x,y`) avec **repli dans l'ordre** si le premier échoue.
- Un faux fournisseur (journalisé en développement, boucle de test) est fourni d'emblée.
- L'envoi passe par un job (file BullMQ) : l'API ne bloque pas sur un fournisseur lent.
- Aucun code de vérification dans les logs.

## Sécurité (rappels non négociables)

- Code à 6 chiffres via générateur cryptographique, stocké en HMAC, valable 5 min, 5 essais ; limites par identifiant, adresse IP et appareil ; réponse identique que le compte existe ou non.
- E-mail normalisé (casse, espaces) et téléphone au format E.164 ; **index aveugle HMAC** pour retrouver un compte, valeur chiffrée (AES-GCM, contexte lié à l'utilisateur).
- Jetons de rafraîchissement à rotation : réutilisation d'un jeton consommé = révocation de toute la famille + alerte + audit.
- Date de naissance et identité : données personnelles chiffrées ; minimisation ; anonymisation plutôt que suppression pour conserver le ledger.
- Un utilisateur inscrit par e-mail devra fournir un numéro de téléphone mobile money au moment d'une recharge ou d'un envoi (MeSomb en a besoin) : ce n'est pas son identifiant de connexion.

## Impacts sur le modèle de données (`security.prisma` à adapter en Phase 3)

- Utilisateur : identifiant principal typé (`EMAIL` | `PHONE`), e-mail et téléphone optionnels (chacun avec valeur chiffrée + index aveugle unique), `onboardingCompletedAt`, `pinSetAt`, prénom, nom, pays (ISO), date de naissance (chiffrée), état `PENDING` → `ACTIVE`.
- `IdempotencyKey` existe déjà dans `core.prisma` : **ne pas le redéclarer**.
- Les tables d'OTP portent le canal (`SMS` | `EMAIL`).

## Questions à trancher avant la Phase 3

1. Fournisseurs réels pour le SMS et pour l'e-mail (le port permet d'en brancher plusieurs).
2. Pays pris en charge au lancement (liste du formulaire d'onboarding, format des numéros).
3. Champs exacts de l'onboarding au-delà de nom, prénom, pays, date de naissance.
4. Le PIN est-il vérifié côté serveur à chaque ouverture (proposition ci-dessus, recommandée) ?
5. Délai d'inactivité avant de redemander le PIN pendant une session ouverte.
