// Example ID Generator
const IdGenerator = {
    counters: {},
    getNextId: function(prefix) {
        if (!this.counters[prefix]) {
            this.counters[prefix] = 0;
        }
        this.counters[prefix]++;
        return prefix + this.counters[prefix];
    }
};

// Geometric Primitive Classes
class Point {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
    }
    toString() {
        return `Point ${this.id}(${this.x.toFixed(1)}, ${this.y.toFixed(1)})`;
    }
}

class LineSegment {
    constructor(id, point1, point2) {
        this.id = id;
        this.p1 = point1;
        this.p2 = point2;
    }
    length() {
        return Phaser.Math.Distance.Between(this.p1.x, this.p1.y, this.p2.x, this.p2.y);
    }
    toString() {
        return `Segment ${this.id}(${this.p1.id}, ${this.p2.id})`;
    }
}

class Triangle {
    constructor(id, point1, point2, point3) {
        this.id = id;
        this.p1 = point1;
        this.p2 = point2;
        this.p3 = point3;
    }
    toString() {
        return `Triangle ${this.id}(${this.p1.id}, ${this.p2.id}, ${this.p3.id})`;
    }
}

class Angle {
    constructor(id, p1, vertex, p2) {
        this.id = id;
        this.p1 = p1;
        this.vertex = vertex;
        this.p2 = p2;
    }
    getValue() {
        const angleRadPVertexP1 = Phaser.Math.Angle.BetweenPoints(this.vertex, this.p1);
        const angleRadPVertexP2 = Phaser.Math.Angle.BetweenPoints(this.vertex, this.p2);
        let angleDeg = Phaser.Math.RadToDeg(angleRadPVertexP2 - angleRadPVertexP1);
        angleDeg = (angleDeg + 360) % 360;
        return angleDeg;
    }
    toString() {
        return `Angle ${this.id}(${this.p1.id}, ${this.vertex.id}, ${this.p2.id})`;
    }
}

class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.points = {};
        this.segments = {};
        this.triangles = {};
        this.angles = {};
        this.graphics = null;
        this.idLabels = []; 

        this.currentDrawingMode = null;
        this.temporaryPoints = [];
        this.snapTolerance = 15;
        this.selectedPointForDrag = null;
    }

    preload() {
        console.log('MainScene preload');
    }

    create() {
        console.log('MainScene create');
        this.graphics = this.add.graphics();
        this.idTextStyle = { font: '10px Arial', fill: '#333333', backgroundColor: 'rgba(255,255,255,0.5)', padding: {x:1, y:1} };

        const addPointBtn = document.getElementById('addPointBtn');
        const addSegmentBtn = document.getElementById('addSegmentBtn');
        const addTriangleBtn = document.getElementById('addTriangleBtn');
        const selectDragBtn = document.getElementById('selectDragBtn');
        this.currentModeFeedbackEl = document.getElementById('currentModeFeedback');

        addPointBtn.addEventListener('click', () => {
            this.setDrawingMode('addPoint');
            this.currentModeFeedbackEl.textContent = 'Mode: Add Point. Click on canvas.';
        });

        addSegmentBtn.addEventListener('click', () => {
            this.setDrawingMode('addSegment_p1');
            this.currentModeFeedbackEl.textContent = 'Mode: Add Segment. Click 1st point.';
        });

        addTriangleBtn.addEventListener('click', () => {
            this.setDrawingMode('addTriangle_p1');
            this.currentModeFeedbackEl.textContent = 'Mode: Add Triangle. Click 1st point.';
        });

        selectDragBtn.addEventListener('click', () => {
            this.setDrawingMode('selectDrag');
            this.currentModeFeedbackEl.textContent = 'Mode: Select & Drag. Click a point to drag.';
        });

        this.input.on('pointerdown', this.handleCanvasClick, this);
        this.redrawAll();
    }

    setDrawingMode(mode) {
        console.log(`[DEBUG] setDrawingMode: Called with mode: ${mode}. Previous mode: ${this.currentDrawingMode}`);
        this.currentDrawingMode = mode;
        this.temporaryPoints = []; // This is the key: only clear temp points when a new tool is selected from buttons.
        this.selectedPointForDrag = null; 

        this.input.off('pointermove', this.handlePointerMove, this);
        this.input.off('pointerup', this.handlePointerUp, this);
        
        if (mode === null) {
            this.currentModeFeedbackEl.textContent = 'Mode: None.';
        }
        this.redrawAll();
        console.log(`[DEBUG] setDrawingMode: Mode is now set to: ${this.currentDrawingMode}. Temporary points cleared.`);
    }
    
    getPointAt(x, y, tolerance = this.snapTolerance) {
        for (const id in this.points) {
            const p = this.points[id];
            if (Phaser.Math.Distance.Between(x, y, p.x, p.y) < tolerance) {
                return p;
            }
        }
        return null;
    }

    handleCanvasClick(pointer) {
        console.log(`[DEBUG] handleCanvasClick: Entry. Mode: ${this.currentDrawingMode}, Pointer: (${pointer.x.toFixed(1)}, ${pointer.y.toFixed(1)})`);
        try {
            console.log('[DEBUG] temporaryPoints at start of click:', JSON.parse(JSON.stringify(this.temporaryPoints)));
        } catch (e) { console.error("Error stringifying temporaryPoints", e); }

        const { x, y } = pointer;

        if (this.currentDrawingMode === 'addPoint') {
            console.log('[DEBUG] Matched mode: addPoint');
            const existingPoint = this.getPointAt(x,y);
            console.log('[DEBUG] addPoint: getPointAt result:', existingPoint ? existingPoint.toString() : 'null');
            if (existingPoint) {
                 this.currentModeFeedbackEl.textContent = `Mode: Add Point. Clicked near ${existingPoint.id}. Choose a different spot.`;
                 return; 
            }
            const newPointId = IdGenerator.getNextId('P');
            const newPoint = new Point(newPointId, x, y);
            this.points[newPointId] = newPoint;
            console.log('[DEBUG] addPoint: New point added:', newPoint.toString());
        }
        else if (this.currentDrawingMode === 'addSegment_p1') {
            console.log('[DEBUG] Matched mode: addSegment_p1');
            const p1_candidate = this.getPointAt(x, y);
            console.log('[DEBUG] addSegment_p1: getPointAt result for p1:', p1_candidate ? p1_candidate.toString() : 'null');
            const p1 = p1_candidate || new Point(IdGenerator.getNextId('TEMP_P'), x, y);
            if (p1_candidate) { console.log(`[DEBUG] addSegment_p1: Snapped to existing P1: ${p1.toString()}`); }
            else { console.log(`[DEBUG] addSegment_p1: Created new temporary P1: ${p1.toString()}`); }
            this.temporaryPoints.push(p1);
            try { console.log('[DEBUG] addSegment_p1: temporaryPoints after adding p1:', JSON.parse(JSON.stringify(this.temporaryPoints))); } catch (e) { console.error("Error stringifying temporaryPoints", e); }
            
            console.log(`[DEBUG] addSegment_p1: Directly changing mode to 'addSegment_p2'.`);
            this.currentDrawingMode = 'addSegment_p2'; 
            console.log(`[DEBUG] addSegment_p1: Mode is now: ${this.currentDrawingMode}`);
            this.currentModeFeedbackEl.textContent = 'Mode: Add Segment. Click 2nd point.';
            // REMOVED return; 
        }
        else if (this.currentDrawingMode === 'addSegment_p2') {
            console.log('[DEBUG] Matched mode: addSegment_p2');
            // Ensure temporaryPoints is not empty (should not happen if logic is correct)
            if (this.temporaryPoints.length === 0) {
                console.error("[ERROR] addSegment_p2: temporaryPoints is empty! Resetting mode.");
                this.setDrawingMode(null);
                this.currentModeFeedbackEl.textContent = 'Error. Mode reset.';
                return;
            }
            let p1_instance = this.temporaryPoints[0];
            console.log('[DEBUG] addSegment_p2: p1_instance from temporaryPoints:', p1_instance.toString());
            if (p1_instance.id.startsWith('TEMP_P')) {
                const finalP1Id = IdGenerator.getNextId('P');
                const finalP1 = new Point(finalP1Id, p1_instance.x, p1_instance.y);
                this.points[finalP1Id] = finalP1;
                p1_instance = finalP1;
                console.log('[DEBUG] addSegment_p2: Finalized temporary P1 to:', p1_instance.toString());
            }

            const p2_candidate = this.getPointAt(x, y);
            console.log('[DEBUG] addSegment_p2: getPointAt result for p2:', p2_candidate ? p2_candidate.toString() : 'null');
            const p2_instance = p2_candidate || new Point(IdGenerator.getNextId('P'), x, y);
            if (p2_candidate) { console.log(`[DEBUG] addSegment_p2: Snapped to existing P2: ${p2_instance.toString()}`);}
            else { console.log(`[DEBUG] addSegment_p2: Created new P2: ${p2_instance.toString()}`);}
            
            if (!this.points[p2_instance.id]) {
                this.points[p2_instance.id] = p2_instance;
            }

            const newSegmentId = IdGenerator.getNextId('S');
            const newSegment = new LineSegment(newSegmentId, p1_instance, p2_instance);
            this.segments[newSegmentId] = newSegment;
            console.log('[DEBUG] addSegment_p2: Segment added:', newSegment.toString(), 'with p1:', p1_instance.toString(), 'and p2:', p2_instance.toString());
            try {
                console.log('[DEBUG] addSegment_p2: All points:', JSON.parse(JSON.stringify(this.points)));
                console.log('[DEBUG] addSegment_p2: All segments:', JSON.parse(JSON.stringify(this.segments)));
            } catch (e) { console.error("Error stringifying collections", e); }

            console.log(`[DEBUG] addSegment_p2: About to set mode to null (operation complete).`);
            this.setDrawingMode(null); 
            console.log(`[DEBUG] addSegment_p2: Mode set. Current mode from instance: ${this.currentDrawingMode}`);
            this.currentModeFeedbackEl.textContent = 'Mode: None. Segment added.';
            return; // This return IS correct as the operation is complete.
        }
        else if (this.currentDrawingMode === 'addTriangle_p1') {
            console.log('[DEBUG] Matched mode: addTriangle_p1');
            const p1_candidate = this.getPointAt(x, y);
            console.log('[DEBUG] addTriangle_p1: getPointAt result for p1:', p1_candidate ? p1_candidate.toString() : 'null');
            const p1 = p1_candidate || new Point(IdGenerator.getNextId('TEMP_P'), x, y);
            if (p1_candidate) { console.log(`[DEBUG] addTriangle_p1: Snapped to existing P1: ${p1.toString()}`); }
            else { console.log(`[DEBUG] addTriangle_p1: Created new temporary P1: ${p1.toString()}`); }
            this.temporaryPoints.push(p1);
            try { console.log('[DEBUG] addTriangle_p1: temporaryPoints after adding p1:', JSON.parse(JSON.stringify(this.temporaryPoints))); } catch (e) { console.error("Error stringifying temporaryPoints", e); }

            console.log(`[DEBUG] addTriangle_p1: Directly changing mode to 'addTriangle_p2'.`);
            this.currentDrawingMode = 'addTriangle_p2';
            console.log(`[DEBUG] addTriangle_p1: Mode is now: ${this.currentDrawingMode}`);
            this.currentModeFeedbackEl.textContent = 'Mode: Add Triangle. Click 2nd point.';
            // REMOVED return;
        }
        else if (this.currentDrawingMode === 'addTriangle_p2') {
            console.log('[DEBUG] Matched mode: addTriangle_p2');
             if (this.temporaryPoints.length === 0) { // Should have at least one point
                console.error("[ERROR] addTriangle_p2: temporaryPoints is empty! Resetting mode.");
                this.setDrawingMode(null);
                this.currentModeFeedbackEl.textContent = 'Error. Mode reset.';
                return;
            }
            const p2_candidate = this.getPointAt(x, y);
            console.log('[DEBUG] addTriangle_p2: getPointAt result for p2:', p2_candidate ? p2_candidate.toString() : 'null');
            const p2 = p2_candidate || new Point(IdGenerator.getNextId('TEMP_P'), x, y);
            if (p2_candidate) { console.log(`[DEBUG] addTriangle_p2: Snapped to existing P2: ${p2.toString()}`); }
            else { console.log(`[DEBUG] addTriangle_p2: Created new temporary P2: ${p2.toString()}`); }
            this.temporaryPoints.push(p2);
            try { console.log('[DEBUG] addTriangle_p2: temporaryPoints after adding p2:', JSON.parse(JSON.stringify(this.temporaryPoints))); } catch (e) { console.error("Error stringifying temporaryPoints", e); }

            console.log(`[DEBUG] addTriangle_p2: Directly changing mode to 'addTriangle_p3'.`);
            this.currentDrawingMode = 'addTriangle_p3';
            console.log(`[DEBUG] addTriangle_p2: Mode is now: ${this.currentDrawingMode}`);
            this.currentModeFeedbackEl.textContent = 'Mode: Add Triangle. Click 3rd point.';
            // REMOVED return;
        }
        else if (this.currentDrawingMode === 'addTriangle_p3') {
            console.log('[DEBUG] Matched mode: addTriangle_p3');
            if (this.temporaryPoints.length < 2) { // Should have at least two points
                console.error("[ERROR] addTriangle_p3: temporaryPoints does not have enough points! Resetting mode.");
                this.setDrawingMode(null);
                this.currentModeFeedbackEl.textContent = 'Error. Mode reset.';
                return;
            }
            let p1_final = this.temporaryPoints[0];
            let p2_final = this.temporaryPoints[1];
            console.log('[DEBUG] addTriangle_p3: p1_final from temp:', p1_final.toString());
            console.log('[DEBUG] addTriangle_p3: p2_final from temp:', p2_final.toString());

            if (p1_final.id.startsWith('TEMP_P')) {
                const finalP1Id = IdGenerator.getNextId('P');
                p1_final = new Point(finalP1Id, p1_final.x, p1_final.y);
                this.points[finalP1Id] = p1_final;
                console.log('[DEBUG] addTriangle_p3: Finalized temp P1 to:', p1_final.toString());
            }
            if (p2_final.id.startsWith('TEMP_P')) {
                const finalP2Id = IdGenerator.getNextId('P');
                p2_final = new Point(finalP2Id, p2_final.x, p2_final.y);
                this.points[finalP2Id] = p2_final;
                console.log('[DEBUG] addTriangle_p3: Finalized temp P2 to:', p2_final.toString());
            }

            const p3_candidate = this.getPointAt(x, y);
            console.log('[DEBUG] addTriangle_p3: getPointAt result for p3:', p3_candidate ? p3_candidate.toString() : 'null');
            let p3_final = p3_candidate || new Point(IdGenerator.getNextId('P'), x, y);
            if (p3_candidate) { console.log(`[DEBUG] addTriangle_p3: Snapped to existing P3: ${p3_final.toString()}`);}
            else { console.log(`[DEBUG] addTriangle_p3: Created new P3: ${p3_final.toString()}`);}

            if (!this.points[p3_final.id]) {
                this.points[p3_final.id] = p3_final;
            }

            const newTriangleId = IdGenerator.getNextId('T');
            const newTriangle = new Triangle(newTriangleId, p1_final, p2_final, p3_final);
            this.triangles[newTriangleId] = newTriangle;
            console.log('[DEBUG] addTriangle_p3: Triangle added:', newTriangle.toString(), 'with p1:', p1_final.toString(), ', p2:', p2_final.toString(), ', p3:', p3_final.toString());
            try {
                console.log('[DEBUG] addTriangle_p3: All points:', JSON.parse(JSON.stringify(this.points)));
                console.log('[DEBUG] addTriangle_p3: All triangles:', JSON.parse(JSON.stringify(this.triangles)));
            } catch (e) { console.error("Error stringifying collections", e); }

            console.log(`[DEBUG] addTriangle_p3: About to set mode to null (operation complete).`);
            this.setDrawingMode(null);
            console.log(`[DEBUG] addTriangle_p3: Mode set. Current mode from instance: ${this.currentDrawingMode}`);
            this.currentModeFeedbackEl.textContent = 'Mode: None. Triangle added.';
            return; // This return IS correct.
        }
        else if (this.currentDrawingMode === 'selectDrag') {
            console.log('[DEBUG] Matched mode: selectDrag');
            const clickedPoint = this.getPointAt(pointer.x, pointer.y, this.snapTolerance);
            console.log('[DEBUG] selectDrag: getPointAt result:', clickedPoint ? clickedPoint.toString() : 'null');
            if (clickedPoint) {
                this.selectedPointForDrag = clickedPoint;
                this.currentModeFeedbackEl.textContent = `Mode: Dragging ${clickedPoint.id}. Release to drop.`;
                this.input.on('pointermove', this.handlePointerMove, this);
                this.input.on('pointerup', this.handlePointerUp, this);
                console.log('[DEBUG] selectDrag: Selected point for drag:', clickedPoint.toString());
                console.log('[DEBUG] selectDrag: Added pointermove and pointerup listeners.');
            }
        }

        this.redrawAll(); 
    }

    handlePointerMove(pointer) {
        if (this.currentDrawingMode === 'selectDrag' && this.selectedPointForDrag) {
            if (pointer.isDown) { 
                this.selectedPointForDrag.x = pointer.x;
                this.selectedPointForDrag.y = pointer.y;
                this.redrawAll(); 
            } else {
                console.log('[DEBUG] handlePointerMove: Pointer is not down, calling handlePointerUp.');
                this.handlePointerUp(pointer); 
            }
        }
    }

    handlePointerUp(pointer) {
        console.log(`[DEBUG] handlePointerUp: Active. Mode: ${this.currentDrawingMode}, SelectedPoint: ${this.selectedPointForDrag ? this.selectedPointForDrag.id : 'null'}`);
        if (this.currentDrawingMode === 'selectDrag' && this.selectedPointForDrag) {
            this.selectedPointForDrag.x = pointer.x;
            this.selectedPointForDrag.y = pointer.y;
            console.log('[DEBUG] handlePointerUp: Finished dragging:', this.selectedPointForDrag.toString());
            
            this.selectedPointForDrag = null; 
            this.input.off('pointermove', this.handlePointerMove, this);
            this.input.off('pointerup', this.handlePointerUp, this);
            console.log('[DEBUG] handlePointerUp: Removed pointermove and pointerup listeners.');
            this.currentModeFeedbackEl.textContent = 'Mode: Select & Drag. Click a point to drag.';
            this.redrawAll();
        }
    }

    drawPoint(pointObj, isTemporary = false) {
        let color = isTemporary ? 0xffaa00 : 0x0000ff; 
        let radius = isTemporary ? 3 : 5;

        if (this.selectedPointForDrag && this.selectedPointForDrag.id === pointObj.id) {
            color = 0xff00ff; 
            radius = 7;
        }

        this.graphics.fillStyle(color, 1);
        this.graphics.fillCircle(pointObj.x, pointObj.y, radius);
        this.graphics.lineStyle(1, 0x000000, 1);
        this.graphics.strokeCircle(pointObj.x, pointObj.y, radius);

        if (!isTemporary && this.points[pointObj.id]) { 
            const label = this.add.text(pointObj.x + 8, pointObj.y - 8, pointObj.id, this.idTextStyle);
            this.idLabels.push(label);
        }
    }

    drawLineSegment(segmentObj) {
        this.graphics.lineStyle(2, 0x00ff00, 1);
        this.graphics.beginPath();
        this.graphics.moveTo(segmentObj.p1.x, segmentObj.p1.y);
        this.graphics.lineTo(segmentObj.p2.x, segmentObj.p2.y);
        this.graphics.strokePath();

        const midX = (segmentObj.p1.x + segmentObj.p2.x) / 2;
        const midY = (segmentObj.p1.y + segmentObj.p2.y) / 2;
        const label = this.add.text(midX + 5, midY - 15, segmentObj.id, this.idTextStyle);
        this.idLabels.push(label);
    }

    drawTriangle(triangleObj) {
        this.graphics.lineStyle(2, 0xff0000, 1);
        this.graphics.beginPath();
        this.graphics.moveTo(triangleObj.p1.x, triangleObj.p1.y);
        this.graphics.lineTo(triangleObj.p2.x, triangleObj.p2.y);
        this.graphics.lineTo(triangleObj.p3.x, triangleObj.p3.y);
        this.graphics.closePath();
        this.graphics.strokePath();

        const cX = (triangleObj.p1.x + triangleObj.p2.x + triangleObj.p3.x) / 3;
        const cY = (triangleObj.p1.y + triangleObj.p2.y + triangleObj.p3.y) / 3;
        const label = this.add.text(cX, cY - 10, triangleObj.id, this.idTextStyle);
        this.idLabels.push(label);
    }

    drawAngle(angleObj) {
        const { p1, vertex, p2 } = angleObj;
        if (!this.points[p1.id] || !this.points[vertex.id] || !this.points[p2.id]) {
            return; 
        }

        this.graphics.lineStyle(2, 0xff9900, 1);
        this.graphics.beginPath();
        this.graphics.moveTo(vertex.x, vertex.y);
        this.graphics.lineTo(p1.x, p1.y);
        this.graphics.strokePath();
        this.graphics.beginPath();
        this.graphics.moveTo(vertex.x, vertex.y);
        this.graphics.lineTo(p2.x, p2.y);
        this.graphics.strokePath();
        const radius = 25;
        const startAngleRad = Phaser.Math.Angle.BetweenPoints(vertex, p1);
        const endAngleRad = Phaser.Math.Angle.BetweenPoints(vertex, p2);
        this.graphics.beginPath();
        this.graphics.arc(vertex.x, vertex.y, radius, startAngleRad, endAngleRad, false);
        this.graphics.strokePath();

        const label = this.add.text(vertex.x + 10, vertex.y + 10, angleObj.id, this.idTextStyle);
        this.idLabels.push(label);
    }
    
    redrawAll() {
        console.log('[DEBUG] redrawAll: Called.');
        this.idLabels.forEach(label => label.destroy());
        this.idLabels = [];
        this.graphics.clear();

        for (const id in this.points) {
            this.drawPoint(this.points[id]); 
        }
        this.temporaryPoints.forEach(tempPoint => {
            this.drawPoint(tempPoint, true); 
        });

        for (const id in this.segments) {
            this.drawLineSegment(this.segments[id]);
        }
        for (const id in this.triangles) {
            this.drawTriangle(this.triangles[id]);
        }
        for (const id in this.angles) {
            this.drawAngle(this.angles[id]); 
        }
    }

    update() {
        // console.log('MainScene update');
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'phaser-container',
    scene: [MainScene],
    backgroundColor: '#ffffff',
};

const game = new Phaser.Game(config);
console.log('Phaser Game instance created.');
