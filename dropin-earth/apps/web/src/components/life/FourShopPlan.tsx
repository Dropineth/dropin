'use client';

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import manifest from '@/data/life/site-manifest.json';
import styles from './FourShopPlan.module.css';

type Floor = '1F' | '2F';
type Locale = 'zh' | 'en';
type View = { zoom: number; x: number; y: number };
const rooms = manifest.spaces;
const overview: View = { zoom: 1, x: 0, y: 0 };
const floors: Floor[] = ['1F', '2F'];
const pick = (locale: Locale, zh: string, en: string) => locale === 'zh' ? zh : en;
const bound = (value: number, zoom: number) => Math.max(1 - zoom, Math.min(0, value));

/** The manifest's normalized points locate rooms; they do not trace leased boundaries. */
export function FourShopPlan({ locale, initialFloor = '1F' }: { locale: Locale; initialFloor?: Floor }) {
  const id = useId();
  const [floor, setFloor] = useState<Floor>(initialFloor);
  const [selected, setSelected] = useState(() => rooms.find(room => room.floor === initialFloor)!.unit);
  const [view, setView] = useState<View>(overview);
  const [imageFailed, setImageFailed] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const drag = useRef<{ pointerId: number; x: number; y: number; view: View } | null>(null);
  const selectedRoom = rooms.find(room => room.unit === selected)!;
  const floorRooms = rooms.filter(room => room.floor === floor);
  const sourcePage = floorRooms[0]!.sourcePage;
  const floorArea = floorRooms.reduce((total, room) => total + room.areaSqm, 0).toFixed(2);
  const totalArea = rooms.reduce((total, room) => total + room.areaSqm, 0).toFixed(2);

  function changeFloor(next: Floor) {
    setFloor(next);
    setSelected(rooms.find(room => room.floor === next)!.unit);
    setView(overview);
    setImageFailed(false);
  }
  function selectRoom(unit: string) {
    const room = rooms.find(item => item.unit === unit)!;
    if (room.floor !== floor) { setImageFailed(false); setFloor(room.floor as Floor); }
    setSelected(unit);
    // Preserve a useful close-up when already zoomed, otherwise retain the full drawing.
    setView(current => current.zoom === 1 ? overview : ({ zoom: current.zoom, x: bound(.5 - room.marker.x * current.zoom, current.zoom), y: bound(.5 - room.marker.y * current.zoom, current.zoom) }));
  }
  function changeZoom(delta: number) {
    setView(current => {
      const zoom = Math.max(1, Math.min(4, current.zoom + delta));
      const ratio = zoom / current.zoom;
      return { zoom, x: bound(.5 - (.5 - current.x) * ratio, zoom), y: bound(.5 - (.5 - current.y) * ratio, zoom) };
    });
  }
  function pan(x: number, y: number) {
    setView(current => ({ ...current, x: bound(current.x + x, current.zoom), y: bound(current.y + y, current.zoom) }));
  }
  function focusRoom() {
    const zoom = 3;
    setView({ zoom, x: bound(.5 - selectedRoom.marker.x * zoom, zoom), y: bound(.5 - selectedRoom.marker.y * zoom, zoom) });
  }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : event.key === 'ArrowRight' ? (index + 1) % 2 : event.key === 'ArrowLeft' ? (index + 1) % 2 : null;
    if (target === null) return;
    event.preventDefault();
    changeFloor(floors[target]!);
    tabRefs.current[target]?.focus();
  }
  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (view.zoom === 1 || event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, view };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId || !viewport.current) return;
    const box = viewport.current.getBoundingClientRect();
    setView({ zoom: current.view.zoom, x: bound(current.view.x + (event.clientX - current.x) / box.width, current.view.zoom), y: bound(current.view.y + (event.clientY - current.y) / box.height, current.view.zoom) });
  }

  return <section className={styles.plan} aria-labelledby={`${id}-title`} data-four-shop-plan>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>{pick(locale, '四铺 · 一个导入期计划', 'FOUR ROOMS · ONE INTRODUCTORY PLAN')}</p><h3 id={`${id}-title`}>{pick(locale, '查看四铺位置', 'Locate the four rooms')}</h3></div>
      <div className={styles.total}><strong>{totalArea}<span> m²</span></strong><span>{pick(locale, '规划空间 · 尚未开放', 'Planned space · not open')}</span></div>
    </header>
    <div className={styles.layout}>
      <div className={styles.drawingColumn}>
        <div className={styles.tabs} role="tablist" aria-label={pick(locale, '选择平面图楼层', 'Choose a floor plan')}>
          {floors.map((value, index) => <button key={value} type="button" role="tab" id={`${id}-tab-${value}`} aria-controls={`${id}-panel`} aria-selected={floor === value} tabIndex={floor === value ? 0 : -1} ref={node => { tabRefs.current[index] = node; }} onClick={() => changeFloor(value)} onKeyDown={event => tabKey(event, index)}>{value} · {value === '1F' ? pick(locale, '机库', 'Garage') : pick(locale, '三个服务空间', 'Three service spaces')}</button>)}
        </div>
        <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${floor}`}>
          <div className={styles.drawingMeta}><span>{pick(locale, '来源图纸', 'SOURCE DIAGRAM')} · {floor}</span><span>{floorArea} m² · {pick(locale, `第 ${sourcePage} 页`, `p. ${sourcePage}`)}</span></div>
          <figure className={styles.figure}>
            <div className={styles.viewport} ref={viewport} data-plan-viewport data-zoom={view.zoom} data-pan-x={view.x.toFixed(3)} data-pan-y={view.y.toFixed(3)} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} style={{ touchAction: view.zoom > 1 ? 'none' : 'pan-y' }}>
              <div className={styles.stage} style={{ transform: `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.zoom})` }}>
                <img src={`/life/floorplan-${floor.toLowerCase()}-reference.webp`} width={1684} height={1191} loading="lazy" draggable={false} onError={() => setImageFailed(true)} alt={pick(locale, `${floor} 原平面图，第 ${sourcePage} 页。房间详情及位置说明见下方文字替代。`, `Supplied ${floor} floor plan, page ${sourcePage}. Room details and approximate positions are available in the text alternative below.`)} />
                {!imageFailed && floorRooms.map(room => {
                  const offset = room.markerNumber === '1' ? -34 : room.markerNumber === '2' ? -48 : room.markerNumber === '3' ? 4 : 48;
                  return <div key={room.unit} className={styles.markerAnchor} style={{ left: `${room.marker.x * 100}%`, top: `${room.marker.y * 100}%`, '--room-color': room.markerColor } as CSSProperties}>
                    <div className={styles.markerContent} style={{ transform: `scale(${1 / view.zoom})` }}>
                      <span className={styles.point} aria-hidden="true" />
                      <span className={styles.markerLine} aria-hidden="true" style={{ top: Math.min(0, offset), height: Math.abs(offset) }} />
                      <button type="button" className={styles.marker} style={{ top: offset }} aria-label={pick(locale, `选择 ${room.unit}，${room.areaSqm.toFixed(2)} 平方米`, `Select ${room.unit}, ${room.areaSqm.toFixed(2)} square metres`)} aria-pressed={selected === room.unit} aria-controls={`${id}-room-${room.unit}`} onClick={() => selectRoom(room.unit)}>{room.markerNumber}</button>
                    </div>
                  </div>;
                })}
              </div>
              {imageFailed && <p className={styles.imageError} role="status">{pick(locale, '图纸暂未加载。仍可用下方房间卡片和文字说明查看四铺信息。', 'The diagram could not load. The room cards and text alternative remain available below.')}</p>}
            </div>
            <figcaption className={styles.caption}>{pick(locale, `用户提供《展贸馆各层平面》，第 ${sourcePage} 页。房号与面积据原平面；标记仅示意位置，不代表边界，以正式租赁附件为准。`, `Supplied exhibition-hall floor plans, p. ${sourcePage}. Room numbers and areas follow the source drawing. Markers indicate approximate positions, not boundaries; refer to the formal lease attachment.`)}</figcaption>
          </figure>
          <div className={styles.controls} role="group" aria-label={pick(locale, '图纸查看控制', 'Diagram view controls')}>
            <button type="button" aria-label={pick(locale, '缩小图纸', 'Zoom out')} disabled={view.zoom === 1 || imageFailed} onClick={() => changeZoom(-.5)}>−</button>
            <output aria-label={pick(locale, '当前缩放比例', 'Current zoom')}>{Math.round(view.zoom * 100)}%</output>
            <button type="button" aria-label={pick(locale, '放大图纸', 'Zoom in')} disabled={view.zoom === 4 || imageFailed} onClick={() => changeZoom(.5)}>+</button>
            <button type="button" onClick={focusRoom} disabled={imageFailed}>{pick(locale, '聚焦所选', 'Focus selected')}</button>
            <button type="button" onClick={() => setView(overview)} disabled={view.zoom === 1 || imageFailed}>{pick(locale, '查看全图', 'Full drawing')}</button>
          </div>
          <div className={styles.panRow}>
            <p>{pick(locale, '放大后可拖动图纸，或用方向按钮平移。', 'After zooming, drag the drawing or use the pan buttons.')}</p>
            <div className={styles.panControls} role="group" aria-label={pick(locale, '平移图纸', 'Pan the drawing')}>
              {([{ x: .15, y: 0, zh: '向左查看', en: 'Look left', icon: '←', disabled: view.x >= 0 }, { x: 0, y: .15, zh: '向上查看', en: 'Look up', icon: '↑', disabled: view.y >= 0 }, { x: 0, y: -.15, zh: '向下查看', en: 'Look down', icon: '↓', disabled: view.y <= 1 - view.zoom }, { x: -.15, y: 0, zh: '向右查看', en: 'Look right', icon: '→', disabled: view.x <= 1 - view.zoom }]).map(direction => <button key={direction.en} type="button" aria-label={pick(locale, direction.zh, direction.en)} disabled={direction.disabled || imageFailed} onClick={() => pan(direction.x, direction.y)}>{direction.icon}</button>)}
            </div>
          </div>
        </div>
      </div>
      <div className={styles.rooms} role="group" aria-label={pick(locale, '选择房间以同步图纸标记', 'Select a room to update the diagram marker')}>
        {rooms.map(room => <button type="button" className={styles.room} id={`${id}-room-${room.unit}`} key={room.unit} aria-pressed={selected === room.unit} onClick={() => selectRoom(room.unit)} style={{ '--room-color': room.markerColor } as CSSProperties}>
          <span className={styles.roomTop}><span className={styles.roomIdentity}><span className={styles.roomNumber}>{room.markerNumber}</span><strong>{room.unit}</strong><span>{room.floor}</span></span><span className={styles.selection}>{selected === room.unit ? pick(locale, '已选择', 'Selected') : pick(locale, '选择', 'Select')}</span></span>
          <span className={styles.roomProgram}>{locale === 'zh' ? room.programZh : room.programEn}</span>
          <span className={styles.roomBottom}><strong>{room.areaSqm.toFixed(2)}<span> m²</span></strong><span>{pick(locale, '规划功能', 'Planned use')}</span></span>
        </button>)}
        <p className={styles.selectionStatus} role="status" aria-live="polite">{pick(locale, `当前：${selectedRoom.unit} · ${selectedRoom.floor} · ${selectedRoom.areaSqm.toFixed(2)} 平方米`, `Selected: ${selectedRoom.unit} · ${selectedRoom.floor} · ${selectedRoom.areaSqm.toFixed(2)} m²`)}</p>
      </div>
    </div>
    <details className={styles.textAlternative}>
      <summary>{pick(locale, '查看文字替代与图纸说明', 'Read the text alternative and source notes')}</summary>
      <p>{pick(locale, '1F：L112 位于图纸左下侧翼。2F：L203、L202、L201 位于图纸下侧偏右，从左到右相邻。', '1F: L112 is in the lower-left wing of the drawing. 2F: L203, L202 and L201 are adjacent from left to right in the lower-right portion of the drawing.')}</p>
      <ul>{rooms.map(room => <li key={room.unit}>{room.markerNumber}. {room.unit} · {room.floor} · {room.areaSqm.toFixed(2)} m² · {locale === 'zh' ? room.programZh : room.programEn} · {pick(locale, `原平面第 ${room.sourcePage} 页`, `source plan p. ${room.sourcePage}`)}</li>)}</ul>
      <p>{pick(locale, '规划功能据用户提供的《Life++ CoHERE 671㎡导入期招商体系视觉方案 V2》第 2 页。功能分配为规划，尚不代表签约、消防批准或对外开放；两层之间的实际通行关系未确认。', 'Planned uses follow the supplied Life++ CoHERE 671 m² introductory-space proposal V2, p. 2. These are proposals, not evidence of an executed lease, fire approval or public opening. Connections between the two floors are unconfirmed.')}</p>
    </details>
  </section>;
}
