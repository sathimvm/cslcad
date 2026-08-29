// =====================================================
// MEASURE TOOL (moved from inline index.html)
// =====================================================
const MeasureTool = {
  mode: 'distance', points: [], markers: [], labels: [], group: new THREE.Group(), snapCursor: null,
  previewLine: null, previewLabel: null, lastSnapData: null,
  lastHit: null,
  
  init() {
    Viewer.scene.add(this.group);
    this.snapCursor = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), new THREE.MeshBasicMaterial({color: 0x00ff00, depthTest: false}));
    this.snapCursor.renderOrder = 1000; this.snapCursor.visible = false;
    Viewer.scene.add(this.snapCursor);

    const cssSize = 140;
    const dpr = window.devicePixelRatio || 1;
    const resSize = cssSize * dpr;
    const canvas = document.getElementById('mag-canvas');
    if (canvas) {
      canvas.width = resSize;
      canvas.height = resSize;
      canvas.style.width = cssSize + 'px';
      canvas.style.height = cssSize + 'px';
    }
    
    this.lastSnapData = null;
    this.lastHit = null;
    this.previewLine = null;
    this.previewLabel = null;
  },
  setMode(m) {
      this.mode = m;
      document.querySelectorAll('.measure-btn').forEach(b => b.classList.remove('active'));
      if(document.getElementById('btn-meas-'+m)) document.getElementById('btn-meas-'+m).classList.add('active');
      this.clear();
  },
  getSnappedData(intersect) {
      let snapPoint = intersect.point.clone();
      let isVertex = false;
      let isEdge = false;
      
      if (intersect.object && (intersect.object.isLine || intersect.object.isLineSegments)) {
          isEdge = true;
          return { point: snapPoint, isVertex, isEdge };
      }

      if (intersect.face && intersect.object.geometry) {
          const pos = intersect.object.geometry.attributes.position;
          const m = intersect.object.matrixWorld;
          const a = new THREE.Vector3().fromBufferAttribute(pos, intersect.face.a).applyMatrix4(m);
          const b = new THREE.Vector3().fromBufferAttribute(pos, intersect.face.b).applyMatrix4(m);
          const c = new THREE.Vector3().fromBufferAttribute(pos, intersect.face.c).applyMatrix4(m);
          const center = new THREE.Vector3().addVectors(a,b).add(c).multiplyScalar(1/3);
          
          const dists = [
              {p: a.clone(), d: intersect.point.distanceTo(a), type: 'vertex'}, 
              {p: b.clone(), d: intersect.point.distanceTo(b), type: 'vertex'}, 
              {p: c.clone(), d: intersect.point.distanceTo(c), type: 'vertex'}, 
              {p: center.clone(), d: intersect.point.distanceTo(center), type: 'center'}
          ];
          const edges = [ [a, b], [b, c], [c, a] ];
          edges.forEach(([p1, p2]) => {
              const lineDir = new THREE.Vector3().subVectors(p2, p1);
              const segLenSq = lineDir.lengthSq();
              const ptToA = new THREE.Vector3().subVectors(intersect.point, p1);
              const t = THREE.MathUtils.clamp(lineDir.dot(ptToA) / segLenSq, 0, 1);
              const closest = p1.clone().add(lineDir.multiplyScalar(t));
              dists.push({ p: closest.clone(), d: intersect.point.distanceTo(closest), type: 'edge' });
          });
          dists.sort((x,y) => x.d - y.d);
          const distToCam = Viewer.camera.position.distanceTo(intersect.point);
          const threshold = Math.min(Math.max(distToCam * 0.03, 8), 18);
          if (dists[0].d < threshold) {
              snapPoint.copy(dists[0].p);
              if (dists[0].type === 'vertex') isVertex = true;
              if (dists[0].type === 'edge') isEdge = true;
          }
      }
      return { point: snapPoint, isVertex: isVertex, isEdge: isEdge };
  },
  onMove(e, isDragging) {
      if (!Viewer || !Viewer.camera || !Parser || !Parser.modelGroup) return;
      const mouse = new THREE.Vector2((e.clientX/window.innerWidth)*2-1, -(e.clientY/window.innerHeight)*2+1);
      const raycaster = new THREE.Raycaster(); 
      raycaster.setFromCamera(mouse, Viewer.camera);
      
      const visibleMeshes = [];
      if (Parser.modelGroup.children) {
          Parser.modelGroup.children.forEach(m => {
              if (m && m.visible) {
                  visibleMeshes.push(m);
              }
          });
      }
      
      const hits = raycaster.intersectObjects(Parser.modelGroup.children, true).filter(hit => hit.object.visible);
      let selectedHit = hits.length > 0 ? hits[0] : null;

      if (SectionManager && SectionManager.hasActiveClip()) {
          const activePlanes = SectionManager.getActivePlanes();
          let planeClosest = null;
          activePlanes.forEach(plane => {
              const planePoint = new THREE.Vector3();
              if (raycaster.ray.intersectPlane(plane, planePoint)) {
                  const dist = raycaster.ray.origin.distanceTo(planePoint);
                  if (dist > 0 && (!planeClosest || dist < planeClosest.distance)) {
                      planeClosest = { point: planePoint.clone(), distance: dist };
                  }
              }
          });
          if (planeClosest) {
              const hitDist = selectedHit ? selectedHit.distance : Infinity;
              if (planeClosest.distance <= hitDist + 10) {
                  selectedHit = { point: planeClosest.point, object: null };
              }
          }
      }

      if (selectedHit) {
          this.lastHit = selectedHit;
          const snapData = this.getSnappedData(selectedHit);
          this.lastSnapData = snapData;

          if (App && App.tool === 'section-pick' && App.pickPlaneAxis) {
              document.getElementById(`cut-${App.pickPlaneAxis}-enable`).checked = true;
              SectionManager.onSlider(App.pickPlaneAxis, snapData.point[App.pickPlaneAxis]);
          }

          if (this.snapCursor) {
              this.snapCursor.position.copy(snapData.point);
              const s = Viewer.camera.position.distanceTo(hits[0].point) * 0.005;
              this.snapCursor.scale.set(s,s,s);
              const color = snapData.isVertex ? 0x00ff00 : snapData.isEdge ? 0x4fc3f7 : 0x00ffff;
              this.snapCursor.material.color.setHex(color);
              this.snapCursor.visible = true;
          }

          if (this.mode === 'distance' && this.points.length === 1) {
              this.updatePreviewLine(snapData.point);
          }
          const cursor = document.getElementById('measure-cursor');
          if (cursor) {
              cursor.style.left = e.clientX + 'px';
              cursor.style.top = e.clientY + 'px';
              cursor.style.display = (App && App.tool === 'measure') ? 'flex' : 'none';
          }
          const mag = document.getElementById('magnifier-lens');
          if (mag) mag.style.display = 'none';
      } else {
          this.lastHit = null;
          this.lastSnapData = null;
          if (this.snapCursor) this.snapCursor.visible = false;
          this.clearPreviewLine();
          const mag = document.getElementById('magnifier-lens');
          if (mag) mag.style.display = 'none';
      }
  },
  createLabel(htmlContent, positionVector, isCoord=false) {
      const el = document.createElement('div');
      el.className = 'measure-label' + (isCoord ? ' coord' : ''); 
      el.innerHTML = htmlContent;
      document.getElementById('measure-labels-container').appendChild(el);
      this.labels.push({ el, pos: positionVector });
  },
  updatePreviewLine(targetPoint) {
      if (!this.points.length) return;
      if (!this.previewLine) {
          const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
          this.previewLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffc107, linewidth: 2, depthTest: false, transparent: true, opacity: 0.85 }));
          this.previewLine.renderOrder = 999;
          this.group.add(this.previewLine);
      }
      const startPoint = this.points[0];
      const points = [startPoint.clone(), targetPoint.clone()];
      this.previewLine.geometry.setFromPoints(points);

      const dist = startPoint.distanceTo(targetPoint);
      const mid = new THREE.Vector3().addVectors(startPoint, targetPoint).multiplyScalar(0.5);
      if (!this.previewLabel) {
          const el = document.createElement('div');
          el.className = 'measure-label preview';
          document.getElementById('measure-labels-container').appendChild(el);
          this.previewLabel = { el, pos: mid };
      }
      this.previewLabel.el.innerHTML = `${dist.toFixed(2)} mm`;
      this.previewLabel.pos.copy(mid);
      this.updateLabelPos();
  },
  clearPreviewLine() {
      if (this.previewLine) {
          this.group.remove(this.previewLine);
          this.previewLine.geometry.dispose();
          this.previewLine = null;
      }
      if (this.previewLabel) {
          this.previewLabel.el.remove();
          this.previewLabel = null;
      }
  },
  onClick(snapData) {
    if (!snapData) return;
    const s = Viewer.camera.position.distanceTo(snapData.point) * 0.006;
    const marker = new THREE.Mesh(new THREE.SphereGeometry(s, 12,12), new THREE.MeshBasicMaterial({color: 0xff1744, depthTest: false}));
    marker.position.copy(snapData.point);
    marker.renderOrder = 999;
    this.group.add(marker);
    this.markers.push(marker);

    if(this.mode === 'coord') {
        const worldPt = snapData.point.clone().add(Parser.globalOffset);
        const txt = `<span style="color:#ef5350">X: ${worldPt.x.toFixed(1)}</span><br><span style="color:#66bb6a">Y: ${worldPt.y.toFixed(1)}</span><br><span style="color:#42a5f5">Z: ${worldPt.z.toFixed(1)}</span>`;
        this.createLabel(txt, snapData.point.clone(), true);
    } 
    else if (this.mode === 'distance') {
        this.points.push(snapData.point.clone());
        if (this.points.length === 1) {
            this.createLabel('<span style="opacity:0.7">Start</span>', this.points[0].clone());
            this.updatePreviewLine(this.points[0]);
        }
        if (this.points.length === 2) {
            const geo = new THREE.BufferGeometry().setFromPoints(this.points);
            const line = new THREE.Line(geo, new THREE.LineBasicMaterial({color: 0xff1744, linewidth: 2, depthTest: false}));
            line.renderOrder = 999;
            this.group.add(line);
            
            const dist = this.points[0].distanceTo(this.points[1]);
            const mid = new THREE.Vector3().addVectors(this.points[0], this.points[1]).multiplyScalar(0.5);
            this.createLabel(`${dist.toFixed(2)} mm`, mid);
            
            this.points = []; 
            this.clearPreviewLine();
        }
    }
    this.updateLabelPos();
  },
  updateLabelPos() {
    this.labels.forEach(l => {
        const p = l.pos.clone().project(Viewer.camera);
        l.el.style.left = ((p.x * 0.5 + 0.5) * window.innerWidth) + 'px';
        l.el.style.top = ((-p.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    });
    if (this.previewLabel) {
        const p = this.previewLabel.pos.clone().project(Viewer.camera);
        this.previewLabel.el.style.left = ((p.x * 0.5 + 0.5) * window.innerWidth) + 'px';
        this.previewLabel.el.style.top = ((-p.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    }
  },
  clear() { 
      this.group.clear(); 
      this.points = []; 
      this.markers = []; 
      this.labels.forEach(l => l.el.remove());
      this.labels = [];
      this.clearPreviewLine();
      this.lastSnapData = null;
      this.lastHit = null;
  }
};
