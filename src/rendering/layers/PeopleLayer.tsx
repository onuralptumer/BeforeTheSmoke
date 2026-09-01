/**
 * People.
 *
 * Light bodies with a dark rim and a contact shadow, so they hold up against
 * both the warm floor and the smoke passing over it. Every character type is
 * separated by shape as well as colour — a Navigator has a bare directional
 * notch, a Follower carries two footprint dots, a Slow person a double ring.
 * Exposure thickens a grey outline in three steps against a limit of four, so
 * the last step is a warning rather than a death rattle.
 */

import React from 'react';
import {BlurMask, Circle, Group, Rect} from '@shopify/react-native-skia';

import {AgentState, AgentType} from '../../game/types';
import {Viewport} from '../geometry';
import {palette} from '../../theme';

const BODY = '#EFEBE3';

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
  const c = viewport.cell;
  const r = c * 0.24;
  const rim = Math.max(1, c * 0.05);

  const bodyColor =
    person.state === 'INCAPACITATED'
      ? palette.danger
      : person.state === 'SAFE'
      ? palette.safe
      : BODY;

  const nodes: React.ReactNode[] = [
    <Circle
      key="shadow"
      cx={pos.x + c * 0.04}
      cy={pos.y + c * 0.06}
      r={r * 1.05}
      color={palette.wall}
      opacity={0.4}>
      <BlurMask blur={c * 0.12} style="normal" />
    </Circle>,
    <Circle key="body" cx={pos.x} cy={pos.y} r={r} color={bodyColor} />,
    <Circle
      key="rim"
      cx={pos.x}
      cy={pos.y}
      r={r}
      color={palette.wall}
      style="stroke"
      strokeWidth={rim}
      opacity={0.7}
    />,
  ];

  // Where their attention is. Only while they are still deciding things.
  if (person.state === 'ACTIVE') {
    nodes.push(
      <Circle
        key="notch"
        cx={pos.x + person.facing.dx * r * 0.62}
        cy={pos.y + person.facing.dy * r * 0.62}
        r={r * 0.3}
        color={palette.wall}
      />,
    );
  }

  if (person.type === 'FOLLOWER') {
    const bx = pos.x - person.facing.dx * r * 1.5;
    const by = pos.y - person.facing.dy * r * 1.5;
    const px = -person.facing.dy;
    const py = person.facing.dx;
    nodes.push(
      <Circle
        key="fp1"
        cx={bx + px * r * 0.38}
        cy={by + py * r * 0.38}
        r={r * 0.19}
        color={BODY}
        opacity={0.8}
      />,
      <Circle
        key="fp2"
        cx={bx - px * r * 0.38}
        cy={by - py * r * 0.38}
        r={r * 0.19}
        color={BODY}
        opacity={0.55}
      />,
    );
  }

  if (person.type === 'SLOW') {
    nodes.push(
      <Circle
        key="ring1"
        cx={pos.x}
        cy={pos.y}
        r={r * 1.45}
        color={BODY}
        style="stroke"
        strokeWidth={Math.max(1, c * 0.045)}
        opacity={0.75}
      />,
      <Circle
        key="ring2"
        cx={pos.x}
        cy={pos.y}
        r={r * 1.8}
        color={BODY}
        style="stroke"
        strokeWidth={Math.max(1, c * 0.03)}
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
        r={r + c * 0.1}
        color={palette.smoke}
        style="stroke"
        strokeWidth={Math.max(1, c * 0.04 * person.exposure)}
        opacity={0.4 + 0.2 * person.exposure}
      />,
    );
  }

  if (person.state === 'SAFE') {
    nodes.push(
      <Circle
        key="safeGlow"
        cx={pos.x}
        cy={pos.y}
        r={r * 1.7}
        color={palette.safe}
        opacity={0.4}>
        <BlurMask blur={c * 0.3} style="normal" />
      </Circle>,
      <Circle
        key="safe"
        cx={pos.x}
        cy={pos.y}
        r={r + c * 0.11}
        color={palette.safe}
        style="stroke"
        strokeWidth={Math.max(1.5, c * 0.06)}
      />,
    );
  }

  if (person.state === 'INCAPACITATED') {
    // An assistance icon. There is no graphic injury anywhere in the game.
    const w = r * 0.95;
    const t = Math.max(2, r * 0.3);
    nodes.push(
      <Rect
        key="aid-h"
        x={pos.x - w / 2}
        y={pos.y - t / 2}
        width={w}
        height={t}
        color={BODY}
      />,
      <Rect
        key="aid-v"
        x={pos.x - t / 2}
        y={pos.y - w / 2}
        width={t}
        height={w}
        color={BODY}
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
