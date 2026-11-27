# Spike: "Omarchy in PRoot" on the reference phone (November 2026)

> **Provenance.** Claude Code ran this spike on 2026-11-27 on the reference phone, a moto g54 5G
> (MediaTek MT6855, aarch64, Android 15, rooted). It answers
> [#137](https://github.com/sparesparrow/mcp-prompts/issues/137). Every result below comes from a
> command run on the phone. Commands and log lines are quoted where they decide a question.

## Answer

| Question | Answer |
|---|---|
| Does Hyprland run? | **No.** It aborts with `CBackend::create() failed!` in every mode tried. It needs a GPU it can allocate buffers on (DRM/KMS with GBM). Android keeps the display, and the GPU has no Mesa driver. |
| Does a tiling Wayland desktop run at all? | **Yes, in software.** sway 1.12, headless with the pixman renderer, serves a 1280×720 session over wayvnc. It runs in Arch Linux ARM under PRoot, at about 60 MiB and near-zero idle CPU. |
| At what cost? | About 3.6 GB of disk for the Arch Linux ARM container with the Hyprland, sway and Mesa stacks. Install time was 13 min for the rootfs and 20 min for the packages. |
| What is reusable from Omarchy? | **The data, not the desktop.** The menu definition (JSONC, dotted IDs, `when` conditions, aliases) and the theme palettes (`colors.toml`) are portable. The menu renderer (Quickshell), Hyprland and most of the menu's actions are not. |
| Recommendation | **Drop the Omarchy desktop, adopt parts.** Keep XFCE over TigerVNC as the default. Borrow two ideas from Omarchy's menu format for the router menu: availability conditions and aliases. Keep sway on pixman as a documented option, not a default. |

## 1. Arch Linux ARM in PRoot

- **The obvious path fails.** `proot-distro install archlinux` fails: proot-distro now installs
  from Docker images, and the official `archlinux` image is amd64 only:
  `No image found for architecture 'arm64' in 'archlinux'`.
- **The official rootfs works:** `proot-distro install --name archlinuxarm
  http://os.archlinuxarm.org/os/ArchLinuxARM-aarch64-latest.tar.gz`.
  - **Integrity:** that URL is plain HTTP, and its HTTPS name doesn't match the certificate, so
    proot-distro installs it with no integrity check.
  - **How it was verified:** I downloaded the tarball again with its `.sig`. Sequoia `sqv` verified
    it against the Arch Linux ARM Build System key 68B3537F39A313B3E574D06777193F152BDBE6A6,
    fetched from keyserver.ubuntu.com over HTTPS. `pacman`, `bash`, `libc.so.6` and `pacman.conf`
    in the installed container hash the same as in the verified tarball.
  - **Do the same before using such a container.** After this check, pacman verifies each
    package's signature itself.
- **pacman 7.1** needs `DisableSandbox` in `pacman.conf` under PRoot, because its download sandbox
  relies on Landlock and a separate user.
- `pacman -Syu hyprland wayvnc mesa foot` installed Hyprland 0.57.2, aquamarine 0.16.0, wayvnc
  0.10.2 and Mesa 26.3.1. The kernel and initramfs hooks fail, which is harmless because nothing
  boots that kernel.
- **Not done: the Magisk chroot comparison.** It needs root bind mounts of `/dev`, `/proc` and
  `/sys` on the phone in daily use. That is a change to the phone that this unattended spike did
  not make. Under the chroot, the GPU and display facts below would be the same, so it would not
  change the answer about Hyprland.

## 2. Hyprland: why it cannot run

The phone has three DRM nodes, all visible inside PRoot:

| Node | Driver | What it is |
|---|---|---|
| `/dev/dri/card0` | `mediatek-drm` | The display. Android's SurfaceFlinger is its DRM master. |
| `/dev/dri/card1`, `renderD128` | `pvrsrvkm` | The PowerVR GPU, with Imagination's Android driver. Mesa's PowerVR driver only works with the upstream `powervr` kernel driver, so Mesa has no hardware driver here. |

Hyprland 0.57 runs as a normal user (it refuses root). With `AQ_TRACE=1`, aquamarine reports:

1. **DRM backend:** `No backend was able to open a seat`. PRoot has no logind session and no
   `seatd` socket.
2. **With `seatd -u alarm` running:** seatd does start inside PRoot (`Created VT-bound seat
   seat0`), and aquamarine opens the seat. Then:
   `Couldn't open device at /dev/dri/card1 … not a KMS device`, the same for `card0`, and
   `drm: Found no gpus to use, cannot continue`.
3. **Wayland backend (nested):** with no parent compositor, `wl_display_connect failed`. Inside
   sway, it fails with `Wayland backend cannot start: Missing protocols`, because a
   software-rendered parent offers no dmabuf or GBM.
4. **Every path** ends in `Cannot open backend: no allocator available`. `AQ_BACKENDS=headless`
   changes nothing.
5. **termux-x11 is not an option.** Aquamarine has no X11 backend, so Hyprland cannot run nested
   on an X server at all.

So Hyprland would need a GBM-capable GPU driver. That is panfrost or powervr upstream with Mesa,
on a kernel this phone does not run. Nothing short of a different kernel fixes it.

## 3. What does run: sway on pixman, over VNC

```bash
# as the container's user, XDG_RUNTIME_DIR set
WLR_BACKENDS=headless WLR_RENDERER=pixman WLR_LIBINPUT_NO_DEVICES=1 sway &
wayvnc 127.0.0.1 5911 &          # answers "RFB 003.008"
foot &                           # tiled by sway, rendered in software
```

A `grim` screenshot showed foot tiled full-screen with the sway title bar. Resources were measured
from a fresh start on the phone:

| Session | Memory (RSS, summed) | Idle CPU |
|---|---|---|
| Today: XFCE + TigerVNC (7 processes) | 400 MiB fresh. 79 MiB after hours of idling, once Android had reclaimed pages. | 0.03 CPU s in 120 s |
| sway (pixman, headless) + wayvnc | 60 MiB fresh | 0.0 CPU s in 60 s |

**Not measured:**
- **Battery:** the phone was on AC power the whole time.
- **Input latency:** a VNC viewer on another device would be needed.
- **Rendering cost under load:** pixman renders on the CPU, so a busy screen, such as a browser
  scrolling, will cost more than with XFCE, whose X server also has no GPU. Still unmeasured.

**Why it is not the default:**
- The agent browser ([#144](https://github.com/sparesparrow/mcp-prompts/issues/144)) and the
  user's Chromium run on X display :1. Under sway they would need Xwayland or Chromium's Wayland
  mode, and the browser layer would need retesting.
- XFCE already works.
- Most of the memory difference is reclaimed by Android once the desktop idles.

## 4. What is reusable from Omarchy

Omarchy `main` at 2ebf597 (2026-11-27) was cloned for reading only. Nothing from it was run.

- **The menu is data.** `default/omarchy/omarchy-menu.jsonc` holds 476 entries under nine roots:
  Apps, Appearance, Trigger, Setup, Install, Remove, Update, Learn and System. 398 entries are
  actions.
  - Each entry has an icon, a label, and an `action` (a shell command).
  - Optional fields: `aliases`, plus the shell conditions `when` (184 entries), `checked` and
    `disabled`.
  - Dotted IDs make the tree (`system.reboot`).
- **The renderer is not portable.** `omarchy-menu` is a thin IPC wrapper around a Quickshell
  (QML) plugin. Quickshell needs a Wayland compositor with GPU-backed rendering.
- **Most actions are not portable.** 360 of the 398 actions call other `omarchy-*` scripts. 26
  call Hyprland and 2 call `systemctl`. On the phone, none of these would work as they are.
- **The themes are portable.** There are 23 themes. Each has a `colors.toml` with named roles
  (`accent`, `background`, `foreground`, …) plus app-specific files. The palette could theme a
  Claude Panel scene or a Tasker scene. That is cosmetic, so it is not proposed now.

**Worth adopting** in the router menu (`android-automation-router`, #138), which already has a
fixed eight-branch menu:
- **`when`-style availability.** Hide a leaf whose precondition fails, such as a missing app, adb
  down or MQTT down, instead of listing it and failing later.
- **`aliases`.** Accept the short names people say ("lights", "power") as routes into a branch.

Both are prompt-level changes, with no desktop involved. They are follow-ups, not part of this
spike.

## Recommendation

1. **Drop "Omarchy in PRoot" as a goal.** Hyprland needs a GPU allocator that this class of phone
   does not offer to a guest Linux, whether under PRoot or a chroot.
2. **Keep XFCE over TigerVNC as the default phone desktop.** No change to the phone setup.
3. **Adopt parts:** availability conditions and aliases for the router menu, as a follow-up issue.
4. **Keep sway on pixman, with wayvnc, as a documented option** for a keyboard-driven tiling
   session. It runs, and costs little when idle. Moving the browser layer to it needs its own
   test.
5. **Clean-up:** the Arch Linux ARM container from this spike takes 3.6 GB. Remove it with
   `proot-distro remove archlinuxarm` if it is not wanted.
