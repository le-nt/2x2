# Guard pending character respawns

`Player::onCharacterDied` previously scheduled an unconditional LoadCharacter
five seconds later. A manual character replacement during that wait was then
overwritten by the old character's timer. Disabling CharacterAutoLoads during
the wait likewise had no effect on the queued callback.

The callback now retains weak references to the player and dead character and
checks that the same character is still current and dead, the player remains
in a Players service, and automatic loading is still enabled. Ordinary automatic
respawning remains enabled; original place scripts are unchanged.

The same real RCC fixture fails against the saved original executable with
“Old death timer replaced the newer character” and passes against the fixed
release build. It verifies normal respawn, manual replacement, and disabling
automatic loading. Health bootstrap is still present at three CharacterAdded
events, and the existing legacy controller fixture also passes.

Reproduce with `tools/probe-rcc-runtime.py --rcc PATH --respawn-timers --seconds 21
--output OUTPUT`. The probe uses a trusted, bounded loopback fixture and dummy
credentials. Before/after evidence is in
`tests/evidence/universal-runtime-2026-11-09/native-respawn-timer-comparison.json`.

RCCService and UniversalClient release builds succeeded. Installation used the
existing hash-pinned installer: only Player.cpp changed; original native source
and complete client/server build bytes were backed up and verified first. The
private browser client was staged after checking both test players had left,
with a complete previous-client rollback. Production clients, maps, databases
and the original Windows checkout were untouched.

The guarded server also completed original Undead Coming zombie-win rounds and
started subsequent rounds with two browser clients. The timer fixture proves
the race fix; it does not establish that this explains every observed character
replacement or that sustained combat is fully compatible.
