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
        this.idLabels = []; // To store Phaser Text objects for IDs

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
        this.currentDrawingMode = mode;
        this.temporaryPoints = [];
        this.selectedPointForDrag = null; 

        this.input.off('pointermove', this.handlePointerMove, this);
        this.input.off('pointerup', this.handlePointerUp, this);
        
        console.log('Mode set to:', mode);
        if (mode === null) {
            this.currentModeFeedbackEl.textContent = 'Mode: None.';
        }
        this.redrawAll();
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
        const { x, y } = pointer;

        if (this.currentDrawingMode === 'addPoint') {
            const existingPoint = this.getPointAt(x,y);
            if (existingPoint) {
                 this.currentModeFeedbackEl.textContent = `Mode: Add Point. Clicked near ${existingPoint.id}. Choose a different spot.`;
                 return; 
            }
            const newPointId = IdGenerator.getNextId('P');
            const newPoint = new Point(newPointId, x, y);
            this.points[newPointId] = newPoint;
            console.log('Point added:', newPoint.toString());
        }
        else if (this.currentDrawingMode === 'addSegment_p1') {
            const p1 = this.getPointAt(x, y) || new Point(IdGenerator.getNextId('TEMP_P'), x, y);
            this.temporaryPoints.push(p1);
            this.setDrawingMode('addSegment_p2'); 
            this.currentModeFeedbackEl.textContent = 'Mode: Add Segment. Click 2nd point.';
            return; 
        }
        else if (this.currentDrawingMode === 'addSegment_p2') {
            let p1_instance = this.temporaryPoints[0];
            if (p1_instance.id.startsWith('TEMP_P')) {
                const finalP1Id = IdGenerator.getNextId('P');
                const finalP1 = new Point(finalP1Id, p1_instance.x, p1_instance.y);
                this.points[finalP1Id] = finalP1;
                p1_instance = finalP1;
            }

            const p2_instance = this.getPointAt(x, y) || new Point(IdGenerator.getNextId('P'), x, y);
            if (!this.points[p2_instance.id]) {
                this.points[p2_instance.id] = p2_instance;
            }

            const newSegmentId = IdGenerator.getNextId('S');
            const newSegment = new LineSegment(newSegmentId, p1_instance, p2_instance);
            this.segments[newSegmentId] = newSegment;
            console.log('Segment added:', newSegment.toString());
            this.setDrawingMode(null); 
            this.currentModeFeedbackEl.textContent = 'Mode: None. Segment added.';
            return;
        }
        else if (this.currentDrawingMode === 'addTriangle_p1') {
            const p1 = this.getPointAt(x, y) || new Point(IdGenerator.getNextId('TEMP_P'), x, y);
            this.temporaryPoints.push(p1);
            this.setDrawingMode('addTriangle_p2');
            this.currentModeFeedbackEl.textContent = 'Mode: Add Triangle. Click 2nd point.';
            return;
        }
        else if (this.currentDrawingMode === 'addTriangle_p2') {
            const p2 = this.getPointAt(x, y) || new Point(IdGenerator.getNextId('TEMP_P'), x, y);
            this.temporaryPoints.push(p2);
            this.setDrawingMode('addTriangle_p3');
            this.currentModeFeedbackEl.textContent = 'Mode: Add Triangle. Click 3rd point.';
            return;
        }
        else if (this.currentDrawingMode === 'addTriangle_p3') {
            let p1_final = this.temporaryPoints[0];
            let p2_final = this.temporaryPoints[1];
            let p3_final = this.getPointAt(x, y) || new Point(IdGenerator.getNextId('P'), x, y);

            if (p1_final.id.startsWith('TEMP_P')) {
                const finalP1Id = IdGenerator.getNextId('P');
                p1_final = new Point(finalP1Id, p1_final.x, p1_final.y);
                this.points[finalP1Id] = p1_final;
            }
            if (p2_final.id.startsWith('TEMP_P')) {
                const finalP2Id = IdGenerator.getNextId('P');
                p2_final = new Point(finalP2Id, p2_final.x, p2_final.y);
                this.points[finalP2Id] = p2_final;
            }
            if (!this.points[p3_final.id]) {
                this.points[p3_final.id] = p3_final;
            }

            const newTriangleId = IdGenerator.getNextId('T');
            const newTriangle = new Triangle(newTriangleId, p1_final, p2_final, p3_final);
            this.triangles[newTriangleId] = newTriangle;
            console.log('Triangle added:', newTriangle.toString());
            this.setDrawingMode(null);
            this.currentModeFeedbackEl.textContent = 'Mode: None. Triangle added.';
            return;
        }
        else if (this.currentDrawingMode === 'selectDrag') {
            const clickedPoint = this.getPointAt(pointer.x, pointer.y, this.snapTolerance);
            if (clickedPoint) {
                this.selectedPointForDrag = clickedPoint;
                this.currentModeFeedbackEl.textContent = `Mode: Dragging ${clickedPoint.id}. Release to drop.`;
                this.input.on('pointermove', this.handlePointerMove, this);
                this.input.on('pointerup', this.handlePointerUp, this);
                console.log('Selected point for drag:', clickedPoint.toString());
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
                this.handlePointerUp(pointer); 
            }
        }
    }

    handlePointerUp(pointer) {
        if (this.currentDrawingMode === 'selectDrag' && this.selectedPointForDrag) {
            this.selectedPointForDrag.x = pointer.x;
            this.selectedPointForDrag.y = pointer.y;
            console.log('Finished dragging:', this.selectedPointForDrag.toString());
            
            this.selectedPointForDrag = null; 
            this.input.off('pointermove', this.handlePointerMove, this);
            this.input.off('pointerup', this.handlePointerUp, this);
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

        if (!isTemporary && this.points[pointObj.id]) { // Only draw ID for permanent, existing points
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
        // Ensure all points for the angle are permanent before drawing
        if (!this.points[p1.id] || !this.points[vertex.id] || !this.points[p2.id]) {
            return; // Don't draw angle or its ID if its points aren't finalized
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
        // Clear old ID labels
        this.idLabels.forEach(label => label.destroy());
        this.idLabels = [];

        this.graphics.clear();

        for (const id in this.points) {
            this.drawPoint(this.points[id]); // isTemporary defaults to false
        }
        // Draw temporary points for multi-step drawing operations
        this.temporaryPoints.forEach(tempPoint => {
            this.drawPoint(tempPoint, true); // Pass true for isTemporary
        });

        for (const id in this.segments) {
            this.drawLineSegment(this.segments[id]);
        }
        for (const id in this.triangles) {
            this.drawTriangle(this.triangles[id]);
        }
        for (const id in this.angles) {
            this.drawAngle(this.angles[id]); // drawAngle itself checks if points are permanent
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
