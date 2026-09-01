/**
 * People.
 *
 * Every character type is separated by shape as well as position, never by
 * colour alone: a Navigator has a bare directional notch, a Follower carries
 * two footprint dots, a Slow person a double ring. Exposure thickens a grey
 * outline in three steps against a limit of four, so the last step is a real
 * warning rather than a death rattle.
 */

import React from 'react';
import {Circle, Group, Rect} from '@shopify/react-native-skia';

import {AgentState, AgentType} from '../../game/types';
import {Viewport} from '../geometry';
import {palette} from '../../theme';

export interface PersonView {
  id: string;
  type: AgentType;
  state: AgentState;
  pos: {x: number; y: number} | null;
  facing: {dx: number; dy: number};
  exposure: number;
}

interface Props {
  viewport: Viewport;
  people: PersonView[];
}

function Person({person, viewport}: {person: PersonView; viewport: Viewport}) {
  const {pos} = person;
  if (!pos) {
    return null;
  }
  const r = viewport.cell * 0.3;
  const bodyColor =
    person.state === 'INCAPACITATED' ? palette.structure : palette.wall;

  const nodes: React.ReactNode[] = [
    <Circle key="body" cx={pos.x} cy={pos.y} r={r} color={bodyColor} />,
  ];

  // Direction notch: what currently holds their attention.
  if (person.state === 'ACTIVE') {
    nodes.push(
      <Circle
        key="notch"
        cx={pos.x + person.facing.dx * r * 0.55}
        cy={pos.y + person.facing.dy * r * 0.55}
        r={r * 0.3}
        color={palette.background}
      />,
    );
  }

  if (person.type === 'FOLLOWER') {
    // Two footprints trailing behind the body.
    const bx = pos.x - person.facing.dx * r * 1.35;
    const by = pos.y - person.facing.dy * r * 1.35;
    const px = -person.facing.dy;
    const py = person.facing.dx;
    nodes.push(
      <Circle
        key="fp1"
        cx={bx + px * r * 0.35}
        cy={by + py * r * 0.35}
        r={r * 0.2}
        color={palette.wall}
      />,
      <Circle
        key="fp2"
        cx={bx - px * r * 0.35}
        cy={by - py * r * 0.35}
        r={r * 0.2}
        color={palette.wall}
      />,
    );
  }

  if (person.type === 'SLOW') {
    // Double movement ring: two ticks per step.
    nodes.push(
      <Circle
        key="ring1"
        cx={pos.x}
        cy={pos.y}
        r={r * 1.35}
        color={palette.wall}
        style="stroke"
        strokeWidth={Math.max(1, viewport.cell * 0.045)}
        opacity={0.7}
      />,
      <Circle
        key="ring2"
        cx={pos.x}
        cy={pos.y}
        r={r * 1.65}
        color={palette.wall}
        style="stroke"
        strokeWidth={Math.max(1, viewport.cell * 0.03)}
        opacity={0.4}
      />,
    );
  }

  if (person.exposure > 0 && person.state !== 'SAFE') {
    nodes.push(
      <Circle
        key="exposure"
        cx={pos.x}
        cy={pos.y}
        r={r + viewport.cell * 0.09}
        color={palette.smoke}
        style="stroke"
        strokeWidth={Math.max(1, viewport.cell * 0.04 * person.exposure)}
        opacity={0.35 + 0.2 * person.exposure}
      />,
    );
  }

  if (person.state === 'SAFE') {
    nodes.push(
      <Circle
        key="safe"
        cx={pos.x}
        cy={pos.y}
        r={r + viewport.cell * 0.12}
        color={palette.safe}
        style="stroke"
        strokeWidth={Math.max(1.5, viewport.cell * 0.07)}
      />,
    );
  }

  if (person.state === 'INCAPACITATED') {
    // Assistance icon. No graphic injury anywhere in the game.
    const w = r * 0.9;
    const t = Math.max(2, r * 0.28);
    nodes.push(
      <Rect
        key="aid-h"
        x={pos.x - w / 2}
        y={pos.y - t / 2}
        width={w}
        height={t}
        color={palette.background}
      />,
      <Rect
        key="aid-v"
        x={pos.x - t / 2}
        y={pos.y - w / 2}
        width={t}
        height={w}
        color={palette.background}
      />,
    );
  }

  return <Group>{nodes}</Group>;
}

function PeopleLayerImpl({viewport, people}: Props) {
  return (
    <Group>
      {people.map(person => (
        <Person key={person.id} person={person} viewport={viewport} />
      ))}
    </Group>
  );
}

export const PeopleLayer = React.memo(PeopleLayerImpl);
