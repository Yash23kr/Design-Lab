// code migrated from complete.html

// global parameters

var numSubsteps = 50;
var numPoints = 2;
var defaultRadius = 0.3;
var defaultMass = 1.0;
var gravity = 10;
var dt = 1 / 60;
var edgeDampingCoeff = 0;
var globalDampingCoeff = 0;

var conserveEnergy = false;
var showTrail = false;
var showForces = false;

var numObstacles = 1;
var obstacles = [];
var obstacleRadius = 0.05;

var maxPoints = 4;

var maxTrailLen = 1000;
var trailDist = 0.01;

var mouseCompliance = 0.001;
var mouseDampingCoeff = 100.0;

var canvas = document.getElementById("myCanvas");
var c = canvas.getContext("2d");
var canvasOrig = { x : canvas.width / 2, y : canvas.height / 4};
var simWidth = 2.0;
var pointSize = 6;
var drawScale = canvas.width / simWidth;

var i,j;

// GUI callbacks

document.getElementById("segsSlider").oninput = function() {
	numPoints = Number(this.value) + 1;
	document.getElementById("numSegs").innerHTML = this.value;
	resetPos(false);
    updateMassTable();
}

document.getElementById("edgeDampingSlider").oninput = function() {
	var coeffs = ["0.0", "10.0", "100.0"];
	var coeff = coeffs[Number(this.value)];
	edgeDampingCoeff = Number(coeff);        
	document.getElementById("edgeDamping").innerHTML = coeff;
}

document.getElementById("globalDampingSlider").oninput = function() {
	var coeffs = ["0.0", "0.5", "1.0", "2.0"];
	var coeff = coeffs[Number(this.value)];
	globalDampingCoeff = Number(coeff);        
	document.getElementById("globalDamping").innerHTML = coeff;
}

document.getElementById("obstaclesSlider").oninput = function() {
	numObstacles = Number(this.value);
	document.getElementById("numObstacles").innerHTML = numObstacles;
	generateObstacles(numObstacles);
	resetPos(false);
}
 
// update mass directly from numeric input
function updateMass(val, pointNr) {
    var m = Number(val);
    if (m <= 0) return;
    points[pointNr].invMass = 1.0 / m;
    points[pointNr].size = Math.sqrt(m);
}

// update segment length from numeric input
function updateRadius(val, pointNr) {
    var r = Number(val);
    if (r <= 0) return;
    points[pointNr].radius = r;
    resetPos(false);
}

// hide rows in the mass table beyond the current number of points
function updateMassTable() {
    // header row + data rows
    var rows = document.querySelectorAll('.mass-table tr');
    // first row is header, subsequent correspond to points 1..4
    for (var i = 1; i < rows.length; i++) {
        if (i <= numPoints - 1) {
            rows[i].style.display = '';
        } else {
            rows[i].style.display = 'none';
        }
    }
}

// hook up the new number inputs
var massIds = ["mass1Input","mass2Input","mass3Input"];
var radiusIds = ["radius1Input","radius2Input","radius3Input"];
for (var idx = 0; idx < massIds.length; idx++) {
    (function(i) {
        document.getElementById(massIds[i]).oninput = function() {
            updateMass(this.value, i+1);
        };
    })(idx);
}
for (var idx = 0; idx < radiusIds.length; idx++) {
    (function(i) {
        document.getElementById(radiusIds[i]).oninput = function() {
            updateRadius(this.value, i+1);
        };
    })(idx);
}

function onEnergy() { conserveEnergy = !conserveEnergy; resetPos(false); }
// function onTrail() { showTrail = !showTrail; trail = []; trailLast = 0; }
function onForces() { showForces = !showForces; }
function onUnilateral(nr) { points[nr].unilateral = !points[nr].unilateral; }

// simple 2‑D vector helper
class Vector {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    copy(v)   { return new Vector(this.x, this.y); }
    assign(v) { this.x = v.x; this.y = v.y; }
    plus(v) { return new Vector(this.x + v.x, this.y + v.y); }
    minus(v) { return new Vector(this.x - v.x, this.y - v.y); }
    add(v, s = 1) { this.x += v.x * s; this.y += v.y * s; }
    scale(s) { this.x *= s; this.y *= s; }
    dot(v) { return this.x * v.x + this.y * v.y; }
    normalize() {
        var d = Math.sqrt(this.x * this.x + this.y * this.y);
        if (d > 0) { this.x /= d; this.y /= d; } else this.x = 1;
        return d;
    }
    lenSquared() { return this.x * this.x + this.y * this.y; }
    distSquared(v) { return (this.x - v.x) * (this.x - v.x) + (this.y - v.y) * (this.y - v.y); }
}

// trail support
var trailLast = 0;
var trail = [];

function generateObstacles(numObs) {
    obstacles = [];
    var minDist = obstacleRadius * 2.5;
    var attempts = 0;
    var maxAttempts = 100;
    
    for (var i = 0; i < numObs && attempts < maxAttempts; i++) {
        var pos = new Vector();
        var side = Math.floor(Math.random() * 2);
        
        if (side === 0) {
            pos.x = -0.8 + Math.random() * 0.2;
        } else {
            pos.x = 0.6 + Math.random() * 0.2;
        }
        pos.y = -0.3 + Math.random() * 0.8;
        
        var overlaps = false;
        for (var j = 0; j < obstacles.length; j++) {
            var dx = pos.x - obstacles[j].pos.x;
            var dy = pos.y - obstacles[j].pos.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                overlaps = true;
                attempts++;
                i--;
                break;
            }
        }
        
        if (!overlaps) {
            obstacles.push({ pos: pos, radius: obstacleRadius, isDragging: false });
            attempts = 0;
        }
    }
}

function trailAdd(p) {
    if (trail.length == 0)
        trail.push(p.copy());
    else {
        var d2 = trail[trailLast].distSquared(p);
        if (d2 > trailDist * trailDist) {
            trailLast = (trailLast + 1) % maxTrailLen;
            if (trail.length < maxTrailLen)
                trail.push(p.copy());
            else
                trail[trailLast].assign(p);
        }
    }
}

// pendulum state
var points = [];
for (i = 0; i < maxPoints; i++)
    points.push({
        invMass: i == 0 ? 0 : 1 / defaultMass,
        radius: i == 0 ? 0 : defaultRadius,
        size: 0,
        pos: new Vector(), prev: new Vector(),
        vel: new Vector(), prevVel: new Vector(),
        acc: new Vector(), netForce: new Vector(),
        compliance: 0, unilateral: false,
        force: 0, elongation: 0
    });

function resetPos(equilibrium) {
    var pos = equilibrium ? new Vector(0, 0) : new Vector(points[1].radius, -points[1].radius);
    for (i = 1; i < points.length; i++) {
        p = points[i];
        p.size = Math.sqrt(1.0 / p.invMass);
        pos.y = equilibrium ? pos.y - p.radius : pos.y + p.radius;
        p.pos.assign(pos); p.prev.assign(pos);
        p.vel.x = p.vel.y = 0;
    }
    trail = []; trailLast = 0;
    draw();
}

function draw() {
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.lineWidth = 3; c.font = "15px Arial";
    var x = canvasOrig.x, y = canvasOrig.y;
    for (i = 1; i < numPoints; i++) {
        var avgX = x, avgY = y;
        p = points[i];
        c.strokeStyle = p.compliance > 0 ? "#0000FF" : (p.unilateral ? "#00FF00" : "#000000");
        c.beginPath(); c.moveTo(x, y);
        x = canvasOrig.x + p.pos.x * drawScale;
        y = canvasOrig.y - p.pos.y * drawScale;
        c.lineTo(x, y); c.stroke();
        avgX = (avgX + x) / 2; avgY = (avgY + y) / 2;
        if (showForces)
            c.fillText("  f=" + p.force.toFixed(0) + "N, dx=" + p.elongation.toFixed(4) + "m", avgX, avgY);
    }
    c.lineWidth = 1;
    if (grabPointNr > 0) {
        c.strokeStyle = "#FF8000";
        c.beginPath();
        c.moveTo(canvasOrig.x + grabPoint.pos.x * drawScale, canvasOrig.y - grabPoint.pos.y * drawScale);
        c.lineTo(canvasOrig.x + points[grabPointNr].pos.x * drawScale, canvasOrig.y - points[grabPointNr].pos.y * drawScale);
        c.stroke();
    }
    for (i = 1; i < numPoints; i++) {
        p = points[i];
        x = canvasOrig.x + p.pos.x * drawScale;
        y = canvasOrig.y - p.pos.y * drawScale;
        c.beginPath(); c.arc(x, y, pointSize * p.size, 0, Math.PI*2, true);
        c.closePath(); c.fill();
        if (showForces && p.invMass > 0) {
            var forceScale = 0.03 * drawScale, accelScale = 0.03 * drawScale;
            var fx = p.netForce.x, fy = p.netForce.y;
            var fMag = Math.sqrt(fx*fx+fy*fy);
            if (fMag > 1e-6) {
                var fnx = fx/fMag, fny = fy/fMag;
                var fLen = Math.min(50, fMag*forceScale);
                c.strokeStyle="#FF0000";
                c.beginPath(); c.moveTo(x,y);
                c.lineTo(x+fnx*fLen, y-fny*fLen); c.stroke();
                c.fillText("F="+fMag.toFixed(2), x+5, y-5);
            }
            var ax=p.acc.x, ay=p.acc.y;
            var aMag=Math.sqrt(ax*ax+ay*ay);
            if(aMag>1e-6){
                var anx=ax/aMag, any=ay/aMag;
                var aLen=Math.min(50, aMag*accelScale);
                c.strokeStyle="#0000FF";
                c.beginPath(); c.moveTo(x,y);
                c.lineTo(x+anx*aLen, y-any*aLen); c.stroke();
                c.fillText("a="+aMag.toFixed(2), x+5, y+10);
            }
            if(conserveEnergy){
                var mass=1.0/p.invMass;
                var gMag=mass*gravity;
                var gLen=Math.min(50, gMag*forceScale);
                c.strokeStyle="#00AA00";
                c.beginPath(); c.moveTo(x,y);
                c.lineTo(x, y+gLen); c.stroke();
                c.fillText("mg="+gMag.toFixed(2), x+5, y+25);
            }
            c.strokeStyle="#000000";
        }
    }
    if(trail.length>1){
        c.strokeStyle="#FF0000";
        c.beginPath();
        var pos=(trailLast+1)%trail.length;
        c.moveTo(canvasOrig.x+trail[pos].x*drawScale, canvasOrig.y-trail[pos].y*drawScale);
        for(i=0;i<trail.length-1;i++){pos=(pos+1)%trail.length;
            c.lineTo(canvasOrig.x+trail[pos].x*drawScale, canvasOrig.y-trail[pos].y*drawScale);
        }
        c.stroke(); c.strokeStyle="#000000";
    }
    for (var obsIdx = 0; obsIdx < obstacles.length; obsIdx++) {
        var obs = obstacles[obsIdx];
        c.fillStyle = obs.isDragging ? "#FF8000" : "#FF0000";
        c.beginPath();
        c.arc(canvasOrig.x + obs.pos.x * drawScale, canvasOrig.y - obs.pos.y * drawScale, obs.radius * drawScale, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#000000";
        c.stroke();
    }
}

// simulation helpers
function solveDistPos(p0,p1,d0,compliance,unilateral,dt){
    var w=p0.invMass+p1.invMass;
    if(w==0) return;
    var grad=p1.pos.minus(p0.pos);
    var d=grad.normalize();
    w+=compliance/dt/dt;
    var lambda=(d-d0)/w;
    if(lambda<0&&unilateral) return;
    p1.force=lambda/dt/dt;
    p1.elongation=d-d0;
    p0.pos.add(grad,p0.invMass*lambda);
    p1.pos.add(grad,-p1.invMass*lambda);
}
function solveDistVel(p0,p1,dampingCoeff,dt){
    var n=p1.pos.minus(p0.pos);
    n.normalize();
    var v0=n.dot(p0.vel), v1=n.dot(p1.vel);
    var dv0=(v1-v0)*Math.min(0.5,dampingCoeff*dt*p0.invMass);
    var dv1=(v0-v1)*Math.min(0.5,dampingCoeff*dt*p1.invMass);
    p0.vel.add(n,dv0); p1.vel.add(n,dv1);
}
function solvePointVel(p,dampingCoeff,dt){
    var n=p.vel.copy(), v=n.normalize();
    var dv=-v*Math.min(1.0,dampingCoeff*dt*p.invMass);
    p.vel.add(n,dv);
}
function simulate(dt){
    var sdt=dt/numSubsteps;
    for(var step=0;step<numSubsteps;step++){
        for(i=1;i<numPoints;i++){p=points[i];p.prevVel.assign(p.vel);}        
        for(i=1;i<numPoints;i++){p=points[i];p.vel.y-=gravity*sdt;p.prev.assign(p.pos);p.pos.add(p.vel,sdt);}        
        for(i=0;i<numPoints-1;i++){p=points[i+1];solveDistPos(points[i],p,p.radius,p.compliance,p.unilateral,sdt);}        
        if(grabPointNr>=0) solveDistPos(grabPoint,points[grabPointNr],0,mouseCompliance,false,sdt);
        for(var obsIdx=0;obsIdx<obstacles.length;obsIdx++){var bumper=obstacles[obsIdx];var r=bumper.radius;
            for(i=1;i<numPoints;i++){var p=points[i];var diff=p.pos.minus(bumper.pos);var distSq=diff.x*diff.x+diff.y*diff.y;
                if(distSq<r*r){var dist=Math.sqrt(distSq);var n=new Vector();
                    if(dist>1e-8){n.x=diff.x/dist;n.y=diff.y/dist;}else{var vStep=p.pos.minus(p.prev);if(vStep.lenSquared()>1e-12){n.assign(vStep);n.normalize();}else{n.x=1.0;n.y=0.0;}dist=0.0;}
                    var penetration=r-dist;p.pos.add(n,penetration);var v=p.pos.minus(p.prev);var vn=n.dot(v);if(vn<0){v.add(n,-2*vn);p.prev.assign(p.pos.minus(v));}}}
            for(i=0;i<numPoints-1;i++){var p0=points[i];var p1=points[i+1];var s0=p0.pos;var s1=p1.pos;var seg=s1.minus(s0);var segLenSq=seg.lenSquared();if(segLenSq<1e-10)continue;var toCenter=bumper.pos.minus(s0);var t=toCenter.dot(seg)/segLenSq;if(t<0)t=0;else if(t>1)t=1;var closest=new Vector(s0.x+seg.x*t,s0.y+seg.y*t);var diffSeg=closest.minus(bumper.pos);var distSegSq=diffSeg.lenSquared();if(distSegSq<r*r){var distSeg=Math.sqrt(distSegSq);var nSeg=new Vector();if(distSeg>1e-8){nSeg.x=diffSeg.x/distSeg;nSeg.y=diffSeg.y/distSeg;}else{nSeg.x=1.0;nSeg.y=0.0;distSeg=0.0;}var penetrationSeg=r-distSeg;var w0=p0.invMass;var w1=p1.invMass;var wSum=w0+w1;if(wSum>0){var corr0=penetrationSeg*w0/wSum;var corr1=penetrationSeg*w1/wSum;p0.pos.add(nSeg,corr0);p1.pos.add(nSeg,corr1);var v0=p0.pos.minus(p0.prev);var vn0=nSeg.dot(v0);if(vn0<0){v0.add(nSeg,-2*vn0);p0.prev.assign(p0.pos.minus(v0));}var v1=p1.pos.minus(p1.prev);var vn1=nSeg.dot(v1);if(vn1<0){v1.add(nSeg,-2*vn1);p1.prev.assign(p1.pos.minus(v1));}}}}}
        for(i=1;i<numPoints;i++){p=points[i];p.vel=p.pos.minus(p.prev);p.vel.scale(1/sdt);var dv=p.vel.minus(p.prevVel);p.acc.assign(dv);p.acc.scale(1/sdt);if(p.invMass>0){p.netForce.assign(p.acc);p.netForce.scale(1.0/p.invMass);}else{p.netForce.x=0;p.netForce.y=0;}solvePointVel(p,globalDampingCoeff,sdt);}        
        for(i=0;i<numPoints-1;i++){p=points[i+1];if(p.compliance>0.0)solveDistVel(points[i],p,edgeDampingCoeff,sdt);}if(grabPointNr>=0)solveDistVel(grabPoint,points[grabPointNr],mouseDampingCoeff,sdt);
        if(showTrail)trailAdd(points[numPoints-1].pos);
    }
}

// energy conservation
function computeEnergy(){var E=0;for(i=1;i<numPoints;i++){p=points[i];E+=p.pos.y/p.invMass*gravity+0.5/p.invMass*p.vel.lenSquared();}return E;}
function forceEnergyConservation(prevE){var dE=(computeEnergy()-prevE)/(numPoints-1);if(dE<0){var postE=computeEnergy();for(i=1;i<numPoints;i++){p=points[i];var Ek=0.5/p.invMass*p.vel.lenSquared();var s=Math.sqrt((Ek-dE)/Ek);p.vel.scale(s);}}}

// animation
var requestAnimationFrame = window.requestAnimationFrame ||
	window.mozRequestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.msRequestAnimationFrame;

var timeFrames = 0;
var timeSum = 0;
var paused = false;

function timeStep() {
    var prevE;
    if (conserveEnergy)
        prevE = computeEnergy();
    var startTime = performance.now();
    simulate(dt);
    var endTime = performance.now();
    if (conserveEnergy)
        forceEnergyConservation(prevE);
    timeSum += endTime - startTime;
    timeFrames++;
    if (timeFrames > 10) {
        timeSum /= timeFrames;
        document.getElementById("ms").innerHTML = timeSum.toFixed(3);
        timeFrames = 0;
        timeSum = 0;
    }
    draw();
    if (!paused)
        requestAnimationFrame(timeStep);
}

function step() { paused = true; timeStep(); }
function run() { if (paused) { paused = false; timeStep(); } }

// mouse grab
var grabPointNr = -1;
var grabPoint = { pos : new Vector(), invMass : 0, vel : new Vector() };
var maxGrabDist = 0.5;
var prevConserveEnergy = conserveEnergy;
var grabMouseObstacleIdx = -1;

function onMouse(evt) {
    evt.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var mousePos = new Vector(
        ((evt.clientX - rect.left) - canvasOrig.x) / drawScale,
        (canvasOrig.y - (evt.clientY - rect.top)) / drawScale);
    
    if (evt.type == "mousedown") {
        // Check if clicking on an obstacle
        grabMouseObstacleIdx = -1;
        for (var obsIdx = 0; obsIdx < obstacles.length; obsIdx++) {
            var d2Obs = mousePos.distSquared(obstacles[obsIdx].pos);
            if (d2Obs < obstacles[obsIdx].radius * obstacles[obsIdx].radius * 4) {
                grabMouseObstacleIdx = obsIdx;
                obstacles[obsIdx].isDragging = true;
                canvas.style.cursor = "grabbing";
                break;
            }
        }
        // If no obstacle grabbed, try to grab a pendulum point
        if (grabMouseObstacleIdx < 0) {
            grabPointNr = -1;
            var minGrabDist2 = maxGrabDist * maxGrabDist;
            for (i = 1; i < numPoints; i++) {
                p = points[i];
                var d2 = p.pos.distSquared(mousePos);
                if (d2 < minGrabDist2) {
                    minGrabDist2 = d2;
                    grabPointNr = i;
                    grabPoint.pos.assign(mousePos);
                }
            }
        }
    } else if (evt.type == "mousemove") {
        // Move obstacle if currently dragging
        if (grabMouseObstacleIdx >= 0) {
            obstacles[grabMouseObstacleIdx].pos.assign(mousePos);
            canvas.style.cursor = "grabbing";
        } else if (grabPointNr >= 0) {
            grabPoint.pos.assign(mousePos);
            canvas.style.cursor = "grabbing";
        } else {
            // Check if hovering over an obstacle
            var hoveringObstacle = false;
            for (var obsIdx = 0; obsIdx < obstacles.length; obsIdx++) {
                var d2Obs = mousePos.distSquared(obstacles[obsIdx].pos);
                if (d2Obs < obstacles[obsIdx].radius * obstacles[obsIdx].radius * 4) {
                    hoveringObstacle = true;
                    break;
                }
            }
            canvas.style.cursor = hoveringObstacle ? "grab" : "default";
        }
    } else if (evt.type == "mouseup" || evt.type == "mouseout") {
        if (grabMouseObstacleIdx >= 0) {
            obstacles[grabMouseObstacleIdx].isDragging = false;
        }
        grabMouseObstacleIdx = -1;
        grabPointNr = -1;
        canvas.style.cursor = "default";
    }
}

canvas.addEventListener("mousedown", onMouse);
canvas.addEventListener("mousemove", onMouse);
canvas.addEventListener("mouseup", onMouse);
canvas.addEventListener("mouseout", onMouse);

// main
// generate initial obstacles
generateObstacles(numObstacles);
// set initial masses and radii based on the numeric inputs
for (var i = 1; i <= numPoints; i++) {
    var mElem = document.getElementById("mass" + i + "Input");
    var rElem = document.getElementById("radius" + i + "Input");
    if (mElem) updateMass(mElem.value, i);
    if (rElem) updateRadius(rElem.value, i);
}
// adjust table rows according to initial numPoints
updateMassTable();
resetPos(false);
timeStep();