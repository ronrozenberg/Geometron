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

class ProofStep {
    constructor(id, statement, reason, referencedElementIds = []) {
        this.id = id; 
        this.statement = statement; 
        this.reason = reason; 
        this.referencedElementIds = referencedElementIds; 
    }
    toString() {
        return `Step ${this.id}: ${this.statement} (Reason: ${this.reason}) Refs: [${this.referencedElementIds.join(', ')}]`;
    }
}

class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.points = {};
        this.segments = {};
        this.triangles = {};
        this.angles = {};
        this.proofSteps = [];   
        this.graphics = null;
        this.idLabels = []; 

        this.currentDrawingMode = null;
        this.temporaryPoints = [];
        this.snapTolerance = 15;
        this.selectedPointForDrag = null;
        
        this.stagedProofReferences = []; // Holds IDs of elements selected for the current proof step

        this.proofStatementInput = null;
        this.proofReasonInput = null;
        this.proofReferencesInput = null; // This is the <input readonly>
        this.selectElementsBtn = null;
        this.clearSelectionBtn = null;
        this.selectionModeFeedbackEl = null;
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

        this.proofStatementInput = document.getElementById('proofStatement');
        this.proofReasonInput = document.getElementById('proofReason');
        this.proofReferencesInput = document.getElementById('proofReferences'); // The readonly input
        const addProofStepBtn = document.getElementById('addProofStepBtn');
        
        this.selectElementsBtn = document.getElementById('selectElementsBtn');
        this.clearSelectionBtn = document.getElementById('clearSelectionBtn');
        this.selectionModeFeedbackEl = document.getElementById('selectionModeFeedback');

        if (addProofStepBtn) {
            addProofStepBtn.addEventListener('click', () => this.handleAddProofStep());
        } else { console.error('Add Proof Step button not found!');}

        if (this.selectElementsBtn) {
            this.selectElementsBtn.addEventListener('click', () => {
                if (this.currentDrawingMode === 'selectForProof') {
                    this.setDrawingMode(null); // Turn off selection mode by setting to a neutral state
                    // this.currentModeFeedbackEl.textContent = 'Mode: None.'; // General mode feedback
                    // selectionModeFeedbackEl is cleared by setDrawingMode
                } else {
                    this.setDrawingMode('selectForProof');
                    this.currentModeFeedbackEl.textContent = 'Mode: Selecting for Proof Reference.'; // Main mode feedback
                    this.selectionModeFeedbackEl.textContent = 'Click elements on canvas.'; // Sub-mode feedback
                }
            });
        }  else { console.error('Select Elements button not found!');}

        if (this.clearSelectionBtn) {
            this.clearSelectionBtn.addEventListener('click', () => {
                this.stagedProofReferences = [];
                this.proofReferencesInput.value = ''; 
                this.redrawAll(); 
                console.log('[DEBUG] Cleared staged proof references.');
            });
        } else { console.error('Clear Selection button not found!');}
        
        this.input.on('pointerdown', this.handleCanvasClick, this);
        this.redrawAll();
        this.renderProofDisplay(); 
    }

    setDrawingMode(mode) {
        const oldMode = this.currentDrawingMode;
        console.log(`[DEBUG] setDrawingMode: Called with mode: ${mode}. Previous mode: ${oldMode}`);
        
        this.currentDrawingMode = mode;
        // Only clear temporary points if not transitioning between sub-steps of a drawing mode
        // The fix for segment/triangle creation handles this by not calling setDrawingMode for sub-steps.
        // So, temporaryPoints are cleared when a new tool is chosen from buttons.
        this.temporaryPoints = []; 
        this.selectedPointForDrag = null; 

        this.input.off('pointermove', this.handlePointerMove, this);
        this.input.off('pointerup', this.handlePointerUp, this);
        
        if (mode === null) {
            this.currentModeFeedbackEl.textContent = 'Mode: None.';
        }
        
        // Clear sub-mode specific feedback if mode changed from selectForProof or to something not selectForProof
        if (oldMode === 'selectForProof' && mode !== 'selectForProof') {
            if (this.selectionModeFeedbackEl) this.selectionModeFeedbackEl.textContent = '';
        }
        if (mode !== 'selectForProof' && this.selectionModeFeedbackEl && this.selectionModeFeedbackEl.textContent !== '') {
             if (this.selectionModeFeedbackEl) this.selectionModeFeedbackEl.textContent = '';
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

    // Basic click detection for segments (near midpoint) - VERY ROUGH
    getSegmentAt(x, y, tolerance = 20) {
        for (const id in this.segments) {
            const seg = this.segments[id];
            const midX = (seg.p1.x + seg.p2.x) / 2;
            const midY = (seg.p1.y + seg.p2.y) / 2;
            if (Phaser.Math.Distance.Between(x, y, midX, midY) < tolerance) {
                return seg;
            }
        }
        return null;
    }
    // Basic click detection for triangles (near centroid) - VERY ROUGH
    getTriangleAt(x, y, tolerance = 30) {
        for (const id in this.triangles) {
            const tri = this.triangles[id];
            const cX = (tri.p1.x + tri.p2.x + tri.p3.x) / 3;
            const cY = (tri.p1.y + tri.p2.y + tri.p3.y) / 3;
            if (Phaser.Math.Distance.Between(x, y, cX, cY) < tolerance) {
                return tri;
            }
        }
        return null;
    }
     // Basic click detection for Angles (near vertex) - VERY ROUGH
    getAngleAt(x, y, tolerance = 20) {
        for (const id in this.angles) {
            const angle = this.angles[id];
            if (Phaser.Math.Distance.Between(x, y, angle.vertex.x, angle.vertex.y) < tolerance) {
                return angle;
            }
        }
        return null;
    }


    handleCanvasClick(pointer) {
        console.log(`[DEBUG] handleCanvasClick: Entry. Mode: ${this.currentDrawingMode}, Pointer: (${pointer.x.toFixed(1)}, ${pointer.y.toFixed(1)})`);
        try { console.log('[DEBUG] temporaryPoints at start of click:', JSON.parse(JSON.stringify(this.temporaryPoints))); } 
        catch (e) { console.error("Error stringifying temporaryPoints", e); }
        try { console.log('[DEBUG] stagedProofReferences at start of click:', JSON.parse(JSON.stringify(this.stagedProofReferences))); }
        catch (e) { console.error("Error stringifying stagedProofReferences", e); }


        const { x, y } = pointer;

        if (this.currentDrawingMode === 'addPoint') {
            // ... (addPoint logic as before)
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
            // ... (addSegment_p1 logic as before)
            console.log('[DEBUG] Matched mode: addSegment_p1');
            const p1_candidate = this.getPointAt(x, y);
            console.log('[DEBUG] addSegment_p1: getPointAt result for p1:', p1_candidate ? p1_candidate.toString() : 'null');
            const p1 = p1_candidate || new Point(IdGenerator.getNextId('TEMP_P'), x, y);
            if (p1_candidate) { console.log(`[DEBUG] addSegment_p1: Snapped to existing P1: ${p1.toString()}`); }
            else { console.log(`[DEBUG] addSegment_p1: Created new temporary P1: ${p1.toString()}`); }
            this.temporaryPoints.push(p1);
            try { console.log('[DEBUG] addSegment_p1: temporaryPoints after adding p1:', JSON.parse(JSON.stringify(this.temporaryPoints))); } catch (e) { console.error("Error stringifying temporaryPoints", e); }
            this.currentDrawingMode = 'addSegment_p2'; 
            this.currentModeFeedbackEl.textContent = 'Mode: Add Segment. Click 2nd point.';
        }
        else if (this.currentDrawingMode === 'addSegment_p2') {
            // ... (addSegment_p2 logic as before)
            console.log('[DEBUG] Matched mode: addSegment_p2');
            if (this.temporaryPoints.length === 0) {
                console.error("[ERROR] addSegment_p2: temporaryPoints is empty! Resetting mode.");
                this.setDrawingMode(null); this.currentModeFeedbackEl.textContent = 'Error. Mode reset.'; return;
            }
            let p1_instance = this.temporaryPoints[0];
            if (p1_instance.id.startsWith('TEMP_P')) {
                const finalP1Id = IdGenerator.getNextId('P');
                const finalP1 = new Point(finalP1Id, p1_instance.x, p1_instance.y);
                this.points[finalP1Id] = finalP1; p1_instance = finalP1;
            }
            const p2_instance = this.getPointAt(x, y) || new Point(IdGenerator.getNextId('P'), x, y);
            if (!this.points[p2_instance.id]) { this.points[p2_instance.id] = p2_instance; }
            const newSegmentId = IdGenerator.getNextId('S');
            const newSegment = new LineSegment(newSegmentId, p1_instance, p2_instance);
            this.segments[newSegmentId] = newSegment;
            console.log('[DEBUG] addSegment_p2: Segment added:', newSegment.toString());
            this.setDrawingMode(null); this.currentModeFeedbackEl.textContent = 'Mode: None. Segment added.'; return; 
        }
        else if (this.currentDrawingMode === 'addTriangle_p1') {
            // ... (addTriangle_p1 logic as before)
            console.log('[DEBUG] Matched mode: addTriangle_p1');
            const p1_candidate = this.getPointAt(x, y);
            const p1 = p1_candidate || new Point(IdGenerator.getNextId('TEMP_P'), x, y);
            this.temporaryPoints.push(p1);
            this.currentDrawingMode = 'addTriangle_p2';
            this.currentModeFeedbackEl.textContent = 'Mode: Add Triangle. Click 2nd point.';
        }
        else if (this.currentDrawingMode === 'addTriangle_p2') {
            // ... (addTriangle_p2 logic as before)
            console.log('[DEBUG] Matched mode: addTriangle_p2');
            if (this.temporaryPoints.length === 0) {
                 console.error("[ERROR] addTriangle_p2: temporaryPoints is empty! Resetting mode.");
                 this.setDrawingMode(null); this.currentModeFeedbackEl.textContent = 'Error. Mode reset.'; return;
            }
            const p2_candidate = this.getPointAt(x, y);
            const p2 = p2_candidate || new Point(IdGenerator.getNextId('TEMP_P'), x, y);
            this.temporaryPoints.push(p2);
            this.currentDrawingMode = 'addTriangle_p3';
            this.currentModeFeedbackEl.textContent = 'Mode: Add Triangle. Click 3rd point.';
        }
        else if (this.currentDrawingMode === 'addTriangle_p3') {
            // ... (addTriangle_p3 logic as before)
            console.log('[DEBUG] Matched mode: addTriangle_p3');
            if (this.temporaryPoints.length < 2) {
                console.error("[ERROR] addTriangle_p3: temporaryPoints does not have enough points! Resetting mode.");
                this.setDrawingMode(null); this.currentModeFeedbackEl.textContent = 'Error. Mode reset.'; return;
            }
            let p1_final = this.temporaryPoints[0];
            let p2_final = this.temporaryPoints[1];
            if (p1_final.id.startsWith('TEMP_P')) {
                const finalP1Id = IdGenerator.getNextId('P');
                p1_final = new Point(finalP1Id, p1_final.x, p1_final.y); this.points[finalP1Id] = p1_final;
            }
            if (p2_final.id.startsWith('TEMP_P')) {
                const finalP2Id = IdGenerator.getNextId('P');
                p2_final = new Point(finalP2Id, p2_final.x, p2_final.y); this.points[finalP2Id] = p2_final;
            }
            let p3_final = this.getPointAt(x, y) || new Point(IdGenerator.getNextId('P'), x, y);
            if (!this.points[p3_final.id]) { this.points[p3_final.id] = p3_final; }
            const newTriangleId = IdGenerator.getNextId('T');
            const newTriangle = new Triangle(newTriangleId, p1_final, p2_final, p3_final);
            this.triangles[newTriangleId] = newTriangle;
            console.log('[DEBUG] addTriangle_p3: Triangle added:', newTriangle.toString());
            this.setDrawingMode(null); this.currentModeFeedbackEl.textContent = 'Mode: None. Triangle added.'; return; 
        }
        else if (this.currentDrawingMode === 'selectDrag') {
            // ... (selectDrag logic as before)
            console.log('[DEBUG] Matched mode: selectDrag');
            const clickedPoint = this.getPointAt(pointer.x, pointer.y, this.snapTolerance);
            if (clickedPoint) {
                this.selectedPointForDrag = clickedPoint;
                this.currentModeFeedbackEl.textContent = `Mode: Dragging ${clickedPoint.id}. Release to drop.`;
                this.input.on('pointermove', this.handlePointerMove, this);
                this.input.on('pointerup', this.handlePointerUp, this);
            }
        }
        else if (this.currentDrawingMode === 'selectForProof') {
            console.log('[DEBUG] Matched mode: selectForProof');
            let clickedElementId = null;
            let clickedElementType = null;

            const clickedPoint = this.getPointAt(pointer.x, pointer.y);
            if (clickedPoint) {
                clickedElementId = clickedPoint.id;
                clickedElementType = 'Point';
            } else {
                const clickedSegment = this.getSegmentAt(pointer.x, pointer.y);
                if (clickedSegment) {
                    clickedElementId = clickedSegment.id;
                    clickedElementType = 'Segment';
                } else {
                    const clickedTriangle = this.getTriangleAt(pointer.x, pointer.y);
                    if (clickedTriangle) {
                        clickedElementId = clickedTriangle.id;
                        clickedElementType = 'Triangle';
                    } else {
                        const clickedAngle = this.getAngleAt(pointer.x, pointer.y);
                         if (clickedAngle) {
                            clickedElementId = clickedAngle.id;
                            clickedElementType = 'Angle';
                        }
                    }
                }
            }

            if (clickedElementId) {
                const index = this.stagedProofReferences.indexOf(clickedElementId);
                if (index > -1) {
                    this.stagedProofReferences.splice(index, 1); 
                    console.log(`[DEBUG] Deselected ${clickedElementType} ${clickedElementId} for proof. Staged: ${this.stagedProofReferences.join(', ')}`);
                } else {
                    this.stagedProofReferences.push(clickedElementId); 
                    console.log(`[DEBUG] Selected ${clickedElementType} ${clickedElementId} for proof. Staged: ${this.stagedProofReferences.join(', ')}`);
                }
                this.proofReferencesInput.value = this.stagedProofReferences.join(', ');
            } else {
                console.log('[DEBUG] selectForProof: No element clicked/found at this position.');
            }
        }

        this.redrawAll(); 
    }

    handlePointerMove(pointer) { /* ... (as before) ... */ 
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
    handlePointerUp(pointer) { /* ... (as before) ... */ 
        console.log(`[DEBUG] handlePointerUp: Active. Mode: ${this.currentDrawingMode}, SelectedPoint: ${this.selectedPointForDrag ? this.selectedPointForDrag.id : 'null'}`);
        if (this.currentDrawingMode === 'selectDrag' && this.selectedPointForDrag) {
            this.selectedPointForDrag.x = pointer.x;
            this.selectedPointForDrag.y = pointer.y;
            console.log('[DEBUG] handlePointerUp: Finished dragging:', this.selectedPointForDrag.toString());
            this.selectedPointForDrag = null; 
            this.input.off('pointermove', this.handlePointerMove, this);
            this.input.off('pointerup', this.handlePointerUp, this);
            this.currentModeFeedbackEl.textContent = 'Mode: Select & Drag. Click a point to drag.';
            this.redrawAll();
        }
    }

    handleAddProofStep() {
        console.log('[DEBUG] handleAddProofStep: Called.');
        if (!this.proofStatementInput || !this.proofReasonInput || !this.proofReferencesInput) {
            console.error('[ERROR] Proof input form elements not found!');
            alert('Error: Proof input form elements are missing. Cannot add step.');
            return;
        }
        const statement = this.proofStatementInput.value.trim();
        const reason = this.proofReasonInput.value.trim();
        // const referencesStr = this.proofReferencesInput.value.trim(); // OLD
        // const referencedElementIds = referencesStr ? referencesStr.split(',').map(id => id.trim()).filter(id => id) : []; // OLD
        const referencedElementIds = [...this.stagedProofReferences]; // NEW

        if (!statement) { alert('Statement cannot be empty.'); return; }
        if (!reason) { alert('Reason cannot be empty.'); return; }

        const stepId = IdGenerator.getNextId('Step');
        const newStep = new ProofStep(stepId, statement, reason, referencedElementIds);
        this.proofSteps.push(newStep);

        console.log('Proof step added:', newStep.toString());
        try { console.log('Current proof steps:', this.proofSteps.map(s => s.toString()));}
        catch(e) { console.error("Error logging proof steps array", e); }

        this.proofStatementInput.value = '';
        this.proofReasonInput.value = '';
        this.proofReferencesInput.value = ''; // Clear the readonly field
        this.stagedProofReferences = []; // Clear the internal array

        this.renderProofDisplay();
        this.redrawAll(); // To remove highlights from canvas
    }

    renderProofDisplay() {
        console.log('[DEBUG] renderProofDisplay called.');
        const proofStepsListEl = document.getElementById('proof-steps-list');
        if (proofStepsListEl) {
            if (this.proofSteps.length === 0) {
                proofStepsListEl.innerHTML = '<li style="border-bottom: 1px dashed #eee; padding-bottom: 5px; margin-bottom: 5px;"><em>No steps yet.</em></li>';
            } else {
                proofStepsListEl.innerHTML = this.proofSteps.map(step => {
                    return `<li data-step-id="${step.id}"><strong>${step.id}:</strong> ${step.statement} <em>(Reason: ${step.reason})</em> ${step.referencedElementIds.length > 0 ? `Refs: [${step.referencedElementIds.join(', ')}]` : ''}</li>`;
                }).join('');
            }
        } else { console.error('Proof steps list element not found!');}
    }

    drawPoint(pointObj, isTemporary = false) {
        let color = isTemporary ? 0xffaa00 : 0x0000ff; 
        let radius = isTemporary ? 3 : 5;
        let BORDER_THICKNESS = 1;

        if (this.selectedPointForDrag && this.selectedPointForDrag.id === pointObj.id) {
            color = 0xff00ff; radius = 7;
        }
        if (this.stagedProofReferences.includes(pointObj.id)) {
            this.graphics.lineStyle(3, 0x4444ff, 0.9); // Blueish highlight outline
            this.graphics.strokeCircle(pointObj.x, pointObj.y, radius + 3);
            BORDER_THICKNESS = 2; // Make border thicker if highlighted
        }

        this.graphics.fillStyle(color, 1);
        this.graphics.fillCircle(pointObj.x, pointObj.y, radius);
        this.graphics.lineStyle(BORDER_THICKNESS, 0x000000, 1);
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

        if (this.stagedProofReferences.includes(segmentObj.id)) {
            this.graphics.lineStyle(4, 0x4444ff, 0.6); // Thicker, semi-transparent blue highlight over the green
            this.graphics.beginPath();
            this.graphics.moveTo(segmentObj.p1.x, segmentObj.p1.y);
            this.graphics.lineTo(segmentObj.p2.x, segmentObj.p2.y);
            this.graphics.strokePath();
        }

        const midX = (segmentObj.p1.x + segmentObj.p2.x) / 2;
        const midY = (segmentObj.p1.y + segmentObj.p2.y) / 2;
        const label = this.add.text(midX + 5, midY - 15, segmentObj.id, this.idTextStyle);
        this.idLabels.push(label);
    }

    drawTriangle(triangleObj) {
        this.graphics.lineStyle(2, 0xff0000, 1); // Red
        this.graphics.beginPath();
        this.graphics.moveTo(triangleObj.p1.x, triangleObj.p1.y);
        this.graphics.lineTo(triangleObj.p2.x, triangleObj.p2.y);
        this.graphics.lineTo(triangleObj.p3.x, triangleObj.p3.y);
        this.graphics.closePath();
        this.graphics.strokePath();

        if (this.stagedProofReferences.includes(triangleObj.id)) {
            this.graphics.lineStyle(4, 0x4444ff, 0.6); // Thicker, semi-transparent blue highlight
            this.graphics.beginPath();
            this.graphics.moveTo(triangleObj.p1.x, triangleObj.p1.y);
            this.graphics.lineTo(triangleObj.p2.x, triangleObj.p2.y);
            this.graphics.lineTo(triangleObj.p3.x, triangleObj.p3.y);
            this.graphics.closePath();
            this.graphics.strokePath();
        }

        const cX = (triangleObj.p1.x + triangleObj.p2.x + triangleObj.p3.x) / 3;
        const cY = (triangleObj.p1.y + triangleObj.p2.y + triangleObj.p3.y) / 3;
        const label = this.add.text(cX, cY - 10, triangleObj.id, this.idTextStyle);
        this.idLabels.push(label);
    }

    drawAngle(angleObj) {
        const { p1, vertex, p2 } = angleObj;
        if (!this.points[p1.id] || !this.points[vertex.id] || !this.points[p2.id]) { return; }

        let angleColor = 0xff9900; // Orange
        if (this.stagedProofReferences.includes(angleObj.id)) {
            angleColor = 0x4444ff; // Blue highlight for the angle itself (arms and arc)
             this.graphics.lineStyle(4, angleColor, 0.8);
        } else {
            this.graphics.lineStyle(2, angleColor, 1);
        }

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
        for (const id in this.points) { this.drawPoint(this.points[id]); }
        this.temporaryPoints.forEach(tempPoint => { this.drawPoint(tempPoint, true); });
        for (const id in this.segments) { this.drawLineSegment(this.segments[id]); }
        for (const id in this.triangles) { this.drawTriangle(this.triangles[id]); }
        for (const id in this.angles) { this.drawAngle(this.angles[id]); }
    }

    update() { /* console.log('MainScene update'); */ }
}

const config = { /* ... (as before) ... */ 
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'phaser-container',
    scene: [MainScene],
    backgroundColor: '#ffffff',
};
const game = new Phaser.Game(config);
console.log('Phaser Game instance created.');
