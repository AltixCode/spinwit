# Spinwit — what is being built

Guide item 4. Type in the options, spin, get a winner. Plus the two other ways
people settle things: a coin and dice.

## The shape

- A wheel of the user's own entries, spun with a real deceleration curve rather
  than a fixed animation, so the landing is not predictable from the start.
- Saved wheels ("Dinner", "Chores"), so the common lists are one tap away.
- Coin flip and dice as secondary modes in the same app, because they are the
  same question asked differently.

## Fairness, which has to be real

The winner is chosen **first**, by a uniform random draw over the entries, and
the wheel is then animated to land on it. The alternative — spin by a random
angle and read off whatever it stops on — is biased by the entry widths and by
where the pointer sits, and the bias is invisible. A test asserts the
distribution over many draws is flat within tolerance.

Weighted entries and remove-on-win are the paid variants of the same draw, and
they change the distribution deliberately and say so.

## Free and paid

| | Free | Unlocked |
|---|---|---|
| Wheel, coin, dice | ✅ | ✅ |
| Saved wheels | 3 | unlimited |
| Weighted entries | ⬜ | ✅ |
| Remove on win (draw without replacement) | ⬜ | ✅ |
| Spin history | ⬜ | ✅ |

## Ads

Banner on the wheel screen. Interstitial behind the shared pacing rules, on
opening a *different* wheel — never between a spin and its result, which is the
one moment the user is actually waiting for.
