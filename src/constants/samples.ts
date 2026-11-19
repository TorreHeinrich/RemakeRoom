export interface SampleRoomPreset {
  id: string;
  label: string;
  name: string;
  url: string;
  defaultInstructions: string;
}

export interface SampleInspirationPreset {
  id: string;
  label: string;
  url: string;
}

export const SAMPLE_ROOMS: SampleRoomPreset[] = [
  {
    id: 'sample-room-living',
    label: 'Wohnzimmer',
    name: 'Beispielzimmer: Wohnzimmer',
    url: '/src/assets/images/sample_room_living_1795094768640.jpg',
    defaultInstructions:
      'Behalte das graue Sofa und den Eichenboden. Mach die Wände wärmer, weniger Kitsch, mehr Licht und ersetze den alten Couchtisch.',
  },
  {
    id: 'sample-room-bedroom',
    label: 'Schlafzimmer',
    name: 'Beispielzimmer: Schlafzimmer',
    url: '/src/assets/images/sample_room_bedroom_1795095475909.jpg',
    defaultInstructions:
      'Behalte das Eichenbett und das Fischgrätparkett. Streiche die Wände in einem ruhigen Cremeton, ergänze schlichte Nachttische, Leinenbettwäsche und weiches Licht.',
  },
  {
    id: 'sample-room-dining',
    label: 'Esszimmer',
    name: 'Beispielzimmer: Esszimmer',
    url: '/src/assets/images/sample_room_dining_1795095477228.jpg',
    defaultInstructions:
      'Behalte den massiven Holztisch und das Parkett. Tausche die zusammengewürfelten Stühle gegen einheitliche skandinavische Stühle und ergänze eine ruhige Pendelleuchte.',
  },
  {
    id: 'sample-room-office',
    label: 'Arbeitszimmer',
    name: 'Beispielzimmer: Arbeitszimmer',
    url: '/src/assets/images/sample_room_office_1795095476584.jpg',
    defaultInstructions:
      'Behalte den hellen Schreibtisch und den Dielenboden. Schaffe geschlossenen Stauraum für Akten, ordne die Kabel und gestalte eine ruhige, konzentrierte Arbeitsatmosphäre.',
  },
];

export const SAMPLE_INSPIRATIONS: SampleInspirationPreset[] = [
  {
    id: 'sample-inspo-scandi',
    label: 'Skandinavisch Hell',
    url: '/src/assets/images/sample_inspo_scandi_1795094769924.jpg',
  },
  {
    id: 'sample-inspo-japandi',
    label: 'Japandi Ruhig',
    url: '/src/assets/images/sample_inspo_japandi_1795094769255.jpg',
  },
];
