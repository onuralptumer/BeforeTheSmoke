/**
 * Turning a signal must visibly change it.
 *
 * A socket's whole purpose is to let the player choose between the routes out
 * of a junction, and the arrow is the only thing that says which one is
 * selected. If two of a socket's edges draw the same arrow, rotating the signal
 * looks like it did nothing — which is exactly what level 10's middle socket
 * did: both routes leave J3 through the same doorway and only separate two
 * cells later, so both drew an identical arrow pointing north.
 *
 * The fix takes the direction from the cell where the routes diverge rather
 * than from the first cell out of the junction. This asserts the property that
 * fix exists to guarantee, across every socket in the game.
 */

import {LEVELS} from '../src/game/levels';
import {facingFor} from '../src/rendering/layers/SignalLayer';

describe('signal arrows', () => {
  for (const level of LEVELS) {
    it(`${level.id} — every socket points a different way per route`, () => {
      for (const socket of level.signalSockets) {
        const junction = level.graph.nodes.find(
          n => n.id === socket.junctionId,
        );
        expect(junction).toBeDefined();

        const facings = socket.allowedEdgeIds.map(id => {
          const f = facingFor(level, id, junction!.cell, socket);
          return `${Math.round(f.dx)},${Math.round(f.dy)}`;
        });

        expect(new Set(facings).size).toBe(socket.allowedEdgeIds.length);
      }
    });
  }
});
