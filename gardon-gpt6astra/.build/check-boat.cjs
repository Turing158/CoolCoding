const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const app=fs.readFileSync(path.join(__dirname,'garden.js'),'utf8');
const context={console:{warn:()=>{}}};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'three-r160.min.js'),'utf8'),context);
const THREE=context.THREE,V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const curveExpression=app.match(/const boatCurve=([^\n]+);/)[1];
const curve=new Function('THREE','V','return '+curveExpression)(THREE,V);
const fieldCode=app.slice(app.indexOf('function lakeField('),app.indexOf('function inStream('));
const lake=new Function(fieldCode+';return inLake;')();
const failures=[];let count=0;
for(let i=0;i<8000;i++){const p=curve.getPointAt(i/8000),t=curve.getTangentAt(i/8000),r=V(t.z,0,-t.x);for(const a of [-.44,.44])for(const b of [-.25,.25]){count++;const x=p.x+t.x*a+r.x*b,z=p.z+t.z*a+r.z*b;const shore=!lake(x,z),dock=x>2.48&&x<3.32&&z>1.70&&z<3.;if(shore||dock)failures.push({i,x,z,shore,dock});}}
console.log(JSON.stringify({samples:count,failures:failures.length,firstFailures:failures.slice(0,3)},null,2));
assert.equal(failures.length,0,'Boat hull must clear the entire shoreline, island and dock along the full route.');
