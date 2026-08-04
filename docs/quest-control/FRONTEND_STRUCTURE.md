# Quest MR Frontend Structure

## Product definition

Subject: a mixed-reality commissioning and supervisory panel for one physical
factory motor.  
Audience: an operator or maintenance technician standing near the equipment.  
Single job: identify the correct motor, understand its current condition, and
request a supervised normal `START` or `STOP` without losing awareness of the
physical workspace.

The Unity project is separate from the React application:

```text
apps/quest-mr/
```

Unity Hub opens that subdirectory directly. Unity-generated `Library`, `Temp`,
`Logs`, and build output must be ignored.

## Information architecture

### Bootstrap

- environment selection for development builds
- authentication
- required permissions
- API and telemetry connectivity
- production feature flags

### Palm launcher

- equipment list
- connection state
- active alarm count
- enter placement mode
- diagnostics and settings

### Machine widget

- `Beacon`: equipment ID and state visible from a distance
- `Compact`: state, data age, current, power, alarm
- `Expanded`: three phases, trends, interlocks, and command tray

The card may toggle between compact and expanded presentation. The real motor
command does not use a single ambiguous toggle; it uses explicit `START` and
`STOP`.

### Placement mode

- select equipment explicitly
- spawn placement ghost
- grab the placement handle
- move and rotate
- show leader line to equipment
- lock and persist anchor
- manage or reset saved anchors

### Command flow

```text
confirming -> request sent -> accepted -> executing
                                      -> PLC-confirmed
                                      -> rejected / failed / unconfirmed
```

## Unity project layout

```text
apps/quest-mr/
├── Assets/
│   └── SmartFactory/
│       ├── Scenes/
│       │   ├── 00_Bootstrap.unity
│       │   ├── 10_MRWorkspace.unity
│       │   ├── 90_ComponentGallery.unity
│       │   └── 91_PlacementSandbox.unity
│       ├── Prefabs/
│       │   ├── App/
│       │   │   └── AppRoot.prefab
│       │   ├── Equipment/
│       │   │   ├── MachineWidget.prefab
│       │   │   ├── MetricCell.prefab
│       │   │   └── PhaseLoadSpine.prefab
│       │   ├── Placement/
│       │   │   ├── PlacementGhost.prefab
│       │   │   └── AnchorPin.prefab
│       │   └── System/
│       │       ├── ConnectionBanner.prefab
│       │       └── ConfirmationSheet.prefab
│       ├── Scripts/
│       │   ├── Core/
│       │   ├── Domain/
│       │   ├── Services/
│       │   ├── Features/
│       │   │   ├── EquipmentWidget/
│       │   │   ├── Placement/
│       │   │   ├── Commands/
│       │   │   ├── Alarms/
│       │   │   └── Authentication/
│       │   ├── Infrastructure/
│       │   │   ├── Aws/
│       │   │   ├── Anchors/
│       │   │   └── Persistence/
│       │   └── Simulation/
│       ├── Config/
│       │   ├── Local.asset
│       │   ├── Staging.asset
│       │   └── Production.asset
│       ├── Art/
│       │   ├── Fonts/
│       │   ├── Icons/
│       │   ├── Materials/
│       │   └── Shaders/
│       └── Tests/
│           ├── EditMode/
│           └── PlayMode/
├── Packages/
└── ProjectSettings/
```

Start with three assembly definitions: `SmartFactory.Domain`,
`SmartFactory.Runtime`, and `SmartFactory.Tests`. More boundaries can be added
when the project earns them.

## MR workspace hierarchy

```text
MRWorkspace
├── XR Origin
│   ├── Controllers
│   └── Hands
├── Passthrough
├── AppRoot
│   ├── SessionController
│   ├── EquipmentRegistry
│   ├── MotorSessionStore
│   ├── TelemetryCoordinator
│   ├── CommandCoordinator
│   └── AnchorRepository
├── WorldAnchors
├── PalmLauncher
├── SystemNotifications
└── ModalLayer
```

Use a world-space Canvas and TextMeshPro first. This is easier to learn and
works with XR Interaction Toolkit controller and hand input.

## Data boundary

```text
MachineWidgetView
        |
MachineWidgetController
        |
MotorSessionStore
   /             \
ITelemetryClient  ICommandClient
   |                    |
Simulator          or AWS API
```

Interfaces:

```text
ITelemetryClient
ICommandClient
IAuthSession
IAnchorRepository
IEquipmentCatalog
IClock
```

The UI never imports AWS IoT SDKs and never knows about `plc/control`. It uses
the same interfaces for local, staging, and production.

Environment ScriptableObjects may contain:

- API and WebSocket URL
- environment label
- `commandsEnabled`
- stale-data threshold
- simulator scenario
- non-secret Cognito client configuration

They must never contain passwords, AWS secret keys, IoT certificates, or bearer
tokens.

## Placement behavior

1. Select `MOTOR-01` from the equipment list.
2. Enter placement mode; operational controls disappear.
3. Spawn a translucent panel approximately 1.2 meters ahead.
4. Grab only its placement handle.
5. Move, rotate, and optionally scale within bounded limits.
6. Show a leader line to the selected physical equipment point.
7. Press `Lock position`.
8. Create and save a persistent spatial anchor.
9. Store `equipmentId -> anchorGuid + local offset`.
10. If relocalization fails, disable control and offer `Reposition`.

Without QR or object recognition, selection is intentionally manual. Always
show the equipment ID prominently. Repositioning in production should require a
supervisor permission.

## Interaction order

### Phase one - controllers

- XR Ray Interactor for pointing
- trigger for UI selection
- XR Grab Interactable on placement handle only
- Tracked Device Graphic Raycaster
- XR UI Input Module

### Phase two - hands

- OpenXR/XR Hands hand ray and pinch
- direct poke after ray interaction is stable
- controller click and pinch route to the same Unity button event

Do not duplicate command logic for each input method.

Use a deliberate hold-to-confirm interaction for `START`. Use one clear press
for operational `STOP`. A headset Stop must state that it is not an emergency
stop.

## Visual direction - Machine Passport

The design is a floating commissioning plate, not a generic neon HUD or a grid
of dashboard cards.

The signature element is a vertical three-phase load spine: L1, L2, and L3
current channels compress into one status beacon when the widget collapses.
This is visually memorable because it expresses a real property of the motor.

### Tokens

```text
Carbon             #0B1419
Instrument white   #EDF5F4
Control blue       #2E7CF6
Verified teal      #22C7A9
Attention amber    #F5B942
Trip red           #F0444A
```

- Panel: Carbon at 92% opacity.
- Border: Instrument white at 14% opacity.
- Equipment labels: Barlow Condensed SemiBold.
- Body: Atkinson Hyperlegible.
- Numeric telemetry: IBM Plex Mono Medium.
- Expanded size: approximately 440 x 286 mm.
- Compact size: approximately 190 x 96 mm.
- Minimum target: 48 x 48 mm.
- Base spacing: 4 mm.
- Corner radius: 12 mm.
- One 180 ms compact/expanded transition.
- No decorative pulsing.

Use icon, label, and color together. Never communicate `RUNNING`, `FAULT`, or
connection state by color alone.

### Design self-critique

The initial temptation was a dark glass dashboard with cyan glow, which is a
generic XR default. That direction was rejected. The revised Machine Passport
uses the visual language of motor nameplates, phase meters, and commissioning
tags. Boldness is spent only on the phase-load spine; controls and failure
states remain quiet and conventional.

## Required states

```text
Connecting
Live / read-only
Live / control-enabled
Telemetry stale
Offline
Authentication expired
Interlock open
Anchor relocalizing
Anchor lost
Command confirming
Request sent
Accepted
Executing
PLC-confirmed
Rejected with reason
Timed out / unconfirmed
```

Disable `START` for:

- stale telemetry
- lost or unresolved anchor
- expired authentication
- missing permission
- unknown equipment identity
- active interlock
- edge or PLC fault
- production control feature flag off

Never display `RUNNING` until reported PLC state confirms it.

## Remote-first validation

- Unity Editor: component gallery and XR Device Simulator.
- Home Quest: cardboard box or fan representing `MOTOR-01`.
- Local: laptop simulator accessed through its LAN address, not `localhost`.
- Replay: timestamped fixtures for repeatable faults and disconnections.
- Staging: Cognito plus AWS APIs with simulated equipment.
- Production: signed build and per-equipment control flag after commissioning.

Test:

- domain parsing and state transitions
- placement and anchor restore
- delayed, duplicate, expired, and rejected commands
- suspend/resume and Wi-Fi loss
- anchor loss always disabling `START`
- UI never changing reported motor state optimistically
- stable Quest frame rate at the selected 72/90 Hz target

## Frontend implementation order

1. Component gallery with a static Machine Passport.
2. Quest shell with passthrough and controller ray.
3. Compact/expanded interaction.
4. Grab, rotate, lock, and persistent anchor.
5. Local simulator telemetry and stale/offline states.
6. Simulated command lifecycle and rejection reasons.
7. Cognito and AWS staging APIs.
8. Pinch and direct hand interaction.
9. Accessibility, performance, haptics, and restrained sound.
10. Factory anchor placement and supervised commissioning.
