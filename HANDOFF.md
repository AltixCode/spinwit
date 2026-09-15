# Spinwit — handoff

What was actually run, and what is still unknown. **Unverified is `UNKNOWN`,
never a pass** — a green build is not a verification.

Last updated: 2026-09-15 (device pass complete, both platforms driven)

## Verification state

| Gate | State | Evidence |
|---|---|---|
| Lint | ✅ | `npm run lint` clean |
| Typecheck | ✅ | `npx tsc --noEmit` clean |
| Unit tests | ✅ | 260 passing, coverage thresholds met |
| i18n completeness (14 locales) | ✅ | `14 locales × 77 keys — complete` |
| UI rules (colour tokens, `t()`) | ✅ | `check-ui-rules: 12 files clean` |
| iOS + Android bundle export | ✅ | `npx expo export` both platforms |
| CI green on a self-hosted runner | ⬜ | |
| `check:release` with real identifiers | ✅ | AdMob + RevenueCat ids present |
| Builds, installs, launches on the iOS simulator | ✅ | iPhone 17 / iOS 27; alive, no UIScene death in the device log |
| Renders in light **and** dark on device | ✅ | both appearances on both platforms |
| Every feature driven on the Android emulator | ✅ | wheel, spin, coin, dice, entries, saved wheels, remove-on-win |
| Purchase flow exercised against a real offering | ⬜ | |
| Ads served under real consent | ✅ | test banner on Android and iOS; ATT declined and UMP completed on iOS |

## Store and service state

| | State | Id |
|---|---|---|
| Bundle id registered | ✅ | `com.altixcode.spinwit` (ASC `637SFWG5HY`) |
| App Store Connect record | ⬜ | |
| iOS IAP created and priced | ⬜ | |
| Play Console app | ⬜ | |
| Play AAB uploaded (internal) | ⬜ | |
| Play in-app product | ⬜ | |
| AdMob apps (iOS + Android) | ✅ | `ca-app-pub-2504845459806550~2550873410` / `~2549468409` |
| AdMob ad units (6) | ✅ | banner, interstitial, rewarded per platform, read back from AdMob |
| AdMob GDPR + US-states messages published | ⬜ | |
| RevenueCat project, apps, entitlement, offering | ✅ | `projeb29330b`; `remove_ads`; `default`/`$rc_lifetime` |

## Decisions the owner owns

- Publish on altixcode.com and itsata.com? **Not yet asked.**

## What the device pass found, which the tests could not

Two real defects, both invisible to 260 passing tests, lint, types and the
bundle export, and both obvious in one screenshot:

- **Half the wheel labels rendered upside down.** Rotating each label by its
  segment angle is right for the top half and inverts the bottom half. Labels
  between 90° and 270° are now flipped a further 180°.
- **With an odd number of options the first and last segments were the same
  colour and touched**, so a three-option wheel drew as two wedges. The last
  segment of an odd wheel now takes a third tone.

## What was proved on device

| Claim | The artifact |
|---|---|
| The spin works end to end | ten spins on Android produced three different winners, each read back out of the app's own SQLite after a force-stop |
| The coin and dice work | `Tails` and `Total 7` read from the live view hierarchy |
| It works on iOS too | entries added and a spin completed through idb, with the winner shown |
| Ads serve | Google test banner rendered on both platforms |
| The consent chain works | ATT declined and the UMP form completed on iOS |

Ten spins says the mechanism works; it says nothing about fairness. Fairness is
the 60,000-draw uniformity test over six entries, which is where that claim
lives.

## Known UNKNOWNs

- **The purchase flow has never been exercised** — no App Store Connect record,
  so no store product, so the offering carries no package.
- **Weighted draws have not been driven on device.** They are premium-only and
  the entitlement cannot resolve without a store product; the weighting itself
  is covered by unit tests.
- **No App Store Connect or Play Console record.** ASC needs a human sign-in.
