import {level05} from '../src/game/levels/level05';
import {WorldMap} from '../src/game/engine/world';
it('free grid', () => {
  const m = new WorldMap(level05);
  const SX=0, SY=10, SW=12, SH=10;
  let out = '    ' + Array.from({length:SW},(_,i)=>String((SX+i)%10)).join('') + '\n';
  for (let y=SY;y<SY+SH;y++){
    let row = String(y).padStart(3)+' ';
    for (let x=SX;x<SX+SW;x++){
      row += m.tiles[y][x] !== 'WALL' ? '#' : '.';
    }
    out += row+'\n';
  }
  console.log('\n# = walkable (corridor), . = free for rooms\n'+out);
});
