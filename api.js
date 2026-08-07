/*******************************************************************
 * API LAYER (v2)
 * Real mode  -> calls the Apps Script Web App (APPS_SCRIPT_URL)
 * Demo mode  -> simulates the same API using localStorage
 *******************************************************************/

const Api = (function () {

  async function realGet(action, params) {
    const q = new URLSearchParams(Object.assign({ action }, params || {}));
    const res = await fetch(APPS_SCRIPT_URL + "?" + q.toString());
    return res.json();
  }
  async function realPost(action, body) {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ action }, body || {}))
    });
    return res.json();
  }

  /* ---------------- DEMO MODE ---------------- */
  const DB_KEY = "appraisal_demo_db_v2";
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  function seedObjectives(entryId, list) {
    return list.map((o,idx) => Object.assign({ ObjectiveID: idx0(entryId,idx), EntryID: entryId, Actual:"", Achv:"", EmployeeComment:"", SortOrder: idx }, o));
  }
  function idx0(entryId, idx) { return entryId + "-O" + idx; }

  function seed() {
    const db = {
      config: { HR_CONSOLE_PIN: "2580", COMPANY_NAME: "FloorKraft Limited (DEMO)", MONTHLY_REMINDER_DAY: "28", HR_NOTIFY_EMAIL: "hr@demo.local" },
      staff: [
        { StaffID: "EMP001", Name: "Amaka Obi", Email: "amaka@demo.local", Department: "Sales", JobTitle: "Sales Executive", Role: "Staff", PIN: "1111", JoinDate: "2025-02-01", Status: "Active", ManagerEmail: "manager@demo.local", Active: true },
        { StaffID: "EMP002", Name: "Ifeoma Chukwu", Email: "ifeoma@demo.local", Department: "Operations", JobTitle: "Installer", Role: "Staff", PIN: "2222", JoinDate: "2025-05-01", Status: "PIP", ManagerEmail: "manager@demo.local", Active: true },
        { StaffID: "EMP003", Name: "Gift Nwosu", Email: "gift@demo.local", Department: "Sales", JobTitle: "Sales Executive", Role: "Staff", PIN: "3333", JoinDate: "2026-07-01", Status: "Probation", ManagerEmail: "manager@demo.local", Active: true },
        { StaffID: "HR001", Name: "Jennifer (HR)", Email: "hr@demo.local", Department: "HR", JobTitle: "Chief Success Officer", Role: "HR", PIN: "9999", JoinDate: "2024-01-01", Status: "Active", ManagerEmail: "", Active: true }
      ],
      cycles: [
        { CycleID: "PIP-DEMO1", StaffID: "EMP002", Type: "PIP", StartDate: "2026-06-01", EndDate: "2026-08-04", OriginalEndDate: "2026-06-30", DurationMonths: 1, CurrentPeriod: 1, Status: "Extended", Reason: "Below target for 2 consecutive months", Notes: "Failed initial PIP review on 2026-07-31; extended by 4 weeks." },
        { CycleID: "PROB-DEMO1", StaffID: "EMP003", Type: "Probation", StartDate: "2026-07-01", EndDate: "2026-10-01", OriginalEndDate: "2026-10-01", DurationMonths: 3, CurrentPeriod: 1, Status: "Active", Reason: "", Notes: "New hire, standard 3-month probation." }
      ],
      entries: [],
      objectives: [],
      finalReviews: [],
      yearly: [],
      suggestions: [],
      audit: []
    };
    // Ifeoma PIP week 1 - already reviewed
    const e1 = { EntryID: "ENT-DEMO1", CycleID: "PIP-DEMO1", StaffID: "EMP002", Type: "PIP", PeriodLabel: "Week ending 2026-07-04", PeriodStart:"", PeriodEnd:"2026-07-04", Status: "Reviewed", OverallScore: 77.8, SubmittedDate: "2026-07-05", CommentedDate: "2026-07-06", SignedDate: "" };
    db.entries.push(e1);
    db.objectives.push(...seedObjectives("ENT-DEMO1", [
      { Objective:"Installation Quality", KeyResult:"Jobs completed without rework", Unit:"%", Weight:100, Target:90, Actual:70, Achv:77.8, EmployeeComment:"Completed 7 jobs, 2 needed rework due to measurement error." }
    ]));
    // Gift probation month 1 - awaiting staff
    const e2 = { EntryID: "ENT-DEMO2", CycleID: "PROB-DEMO1", StaffID: "EMP003", Type: "Probation", PeriodLabel: "Probation Month 1", PeriodStart:"", PeriodEnd:"", Status: "AwaitingStaff", OverallScore: "", SubmittedDate: "", CommentedDate: "", SignedDate: "" };
    db.entries.push(e2);
    db.objectives.push(...seedObjectives("ENT-DEMO2", [
      { Objective:"Revenue Growth", KeyResult:"Achieve monthly sales target", Unit:"₦", Weight:50, Target:500000 },
      { Objective:"New Client Acquisition", KeyResult:"Number of new clients onboarded", Unit:"Count", Weight:30, Target:5 },
      { Objective:"Punctuality & Reporting", KeyResult:"Weekly reports submitted on time", Unit:"%", Weight:20, Target:100 }
    ]));
    return db;
  }

  function loadDb() {
    let db = JSON.parse(localStorage.getItem(DB_KEY) || "null");
    if (!db) { db = seed(); localStorage.setItem(DB_KEY, JSON.stringify(db)); }
    return db;
  }
  function saveDb(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  function newId(prefix) { return prefix + "-" + Date.now() + Math.floor(Math.random()*90+10); }
  function findStaff(db, id) { return db.staff.find(s => s.StaffID === id); }
  function computeAchv(target, actual) { target=parseFloat(target)||0; actual=parseFloat(actual)||0; if(target===0) return 0; return Math.round((actual/target*100)*10)/10; }
  function computeOverall(objs) { let w=0; objs.forEach(o=>{ w += (parseFloat(o.Achv)||0)*(parseFloat(o.Weight)||0)/100; }); return Math.round(w*10)/10; }

  async function demoHandle(action, params) {
    const db = loadDb();
    switch (action) {
      case "login": {
        const s = db.staff.find(x => x.StaffID === params.staffId && x.PIN === params.pin);
        if (!s) return { error: "Invalid ID or PIN" };
        const c = Object.assign({}, s); delete c.PIN; return { staff: c };
      }
      case "hrPinCheck": return { ok: params.pin === db.config.HR_CONSOLE_PIN };
      case "staffList": return db.staff.map(s => { const c=Object.assign({},s); delete c.PIN; return c; });
      case "config": { const c=Object.assign({},db.config); delete c.HR_CONSOLE_PIN; return c; }
      case "staffDashboard": {
        const staff = Object.assign({}, findStaff(db, params.staffId)); delete staff.PIN;
        const cycle = db.cycles.find(c => c.StaffID === params.staffId && (c.Status==='Active'||c.Status==='Extended')) || null;
        const entries = db.entries.filter(e => e.StaffID === params.staffId).map(e => Object.assign({}, e, { objectives: db.objectives.filter(o=>o.EntryID===e.EntryID).sort((a,b)=>a.SortOrder-b.SortOrder) }));
        const finalReviews = db.finalReviews.filter(f => f.StaffID === params.staffId);
        return { staff, cycle, entries, finalReviews };
      }
      case "hrOverview": return db;
      default: return { error: "Unknown demo action " + action };
    }
  }

  async function demoHandlePost(action, body) {
    const db = loadDb();
    switch (action) {
      case "addStaff": {
        const id = body.staffId || newId("EMP");
        db.staff.push({ StaffID:id, Name:body.name, Email:body.email, Department:body.department, JobTitle:body.jobTitle, Role:body.role||"Staff", PIN:body.pin||"0000", JoinDate:body.joinDate||new Date().toISOString(), Status:body.status||"Active", ManagerEmail:body.managerEmail||"", Active:true });
        saveDb(db);
        if ((body.status||"Active")==="Probation") {
          const r = await demoHandlePost("startCycle", { staffId:id, type:"Probation", startDate: body.joinDate, durationMonths:3, silent:true });
          return { ok:true, staffId:id, cycleId:r.cycleId, demoNote:"Demo mode: no real email sent." };
        }
        return { ok:true, staffId:id, demoNote:"Demo mode: no real email sent." };
      }
      case "updateStaff": { Object.assign(findStaff(db, body.staffId), body.patch); saveDb(db); return { ok:true }; }
      case "startCycle": {
        const type = body.type;
        const id = newId(type==="PIP"?"PIP":"PROB");
        const duration = type==="Probation" ? (body.durationMonths||3) : 1;
        const start = body.startDate ? new Date(body.startDate) : new Date();
        let end = body.endDate ? new Date(body.endDate) : new Date(start);
        if (!body.endDate) { if (type==="Probation") end.setMonth(end.getMonth()+duration); else end.setDate(end.getDate()+28); }
        db.cycles.push({ CycleID:id, StaffID:body.staffId, Type:type, StartDate:start.toISOString(), EndDate:end.toISOString(), OriginalEndDate:end.toISOString(), DurationMonths:duration, CurrentPeriod:1, Status:"Active", Reason:body.reason||"", Notes:body.notes||"" });
        const s = findStaff(db, body.staffId); if (s) s.Status = type;
        saveDb(db);
        return { ok:true, cycleId:id, demoNote: body.silent? undefined : "Demo mode: staff would be emailed now." };
      }
      case "editCycle": {
        const rec = db.cycles.find(c=>c.CycleID===body.cycleId); Object.assign(rec, body.patch); saveDb(db); return { ok:true };
      }
      case "createEntry": {
        const entryId = newId("ENT");
        db.entries.push({ EntryID:entryId, CycleID:body.cycleId||"", StaffID:body.staffId, Type:body.type, PeriodLabel:body.periodLabel, PeriodStart:body.periodStart||"", PeriodEnd:body.periodEnd||"", Status:"AwaitingStaff", OverallScore:"", SubmittedDate:"", CommentedDate:"", SignedDate:"" });
        (body.objectives||[]).forEach((o,idx)=>{
          db.objectives.push({ ObjectiveID:newId("OBJ"), EntryID:entryId, Objective:o.objective, KeyResult:o.keyResult, Unit:o.unit, Weight:o.weight, Target:o.target, Actual:"", Achv:"", EmployeeComment:"", SortOrder:idx });
        });
        saveDb(db);
        return { ok:true, entryId, demoNote:"Demo mode: staff would be emailed that objectives are ready." };
      }
      case "updateObjectiveTargets": {
        const obj = db.objectives.find(o=>o.ObjectiveID===body.objectiveId); Object.assign(obj, body.patch); saveDb(db); return { ok:true };
      }
      case "deleteObjective": {
        db.objectives = db.objectives.filter(o=>o.ObjectiveID!==body.objectiveId); saveDb(db); return { ok:true };
      }
      case "submitEntry": {
        const objs = db.objectives.filter(o=>o.EntryID===body.entryId);
        (body.actuals||[]).forEach(a=>{
          const obj = objs.find(o=>o.ObjectiveID===a.objectiveId); if(!obj) return;
          obj.Actual = a.actual; obj.Achv = computeAchv(obj.Target, a.actual); obj.EmployeeComment = a.comment||"";
        });
        const overall = computeOverall(objs);
        const entry = db.entries.find(e=>e.EntryID===body.entryId);
        entry.Status="Submitted"; entry.OverallScore=overall; entry.SubmittedDate=new Date().toISOString();
        saveDb(db);
        return { ok:true, overallScore: overall, demoNote:"Demo mode: HR would be notified by email." };
      }
      case "hrCommentEntry": {
        const entry = db.entries.find(e=>e.EntryID===body.entryId); entry.Status="Reviewed"; entry.CommentedDate=new Date().toISOString();
        entry._hrComments = body.hrComments; entry._improvementPlan = body.improvementPlan;
        saveDb(db); return { ok:true, demoNote:"Demo mode: staff would receive an email with their result now." };
      }
      case "hrSignOffEntry": {
        if (body.hrComments || body.improvementPlan) await demoHandlePost("hrCommentEntry", body);
        const entry = db.entries.find(e=>e.EntryID===body.entryId); entry.Status="Signed"; entry.SignedDate=new Date().toISOString();
        saveDb(db); return { ok:true, demoNote:"Demo mode: staff would receive the signed-off result + improvement plan now." };
      }
      case "closePeriodAndAdvance": {
        const cycle = db.cycles.find(c=>c.CycleID===body.cycleId);
        if (cycle.Type!=='Probation') return { error:"Only Probation auto-advances months." };
        const nextPeriod = cycle.CurrentPeriod+1; const duration = cycle.DurationMonths||3;
        cycle.CurrentPeriod = nextPeriod; saveDb(db);
        if (nextPeriod > duration) return { ok:true, needsFinalReview:true, nextPeriod };
        if (body.nextObjectives && body.nextObjectives.length) {
          const r = await demoHandlePost("createEntry", { staffId:cycle.StaffID, type:"Probation", cycleId:body.cycleId, periodLabel:`Probation Month ${nextPeriod}`, objectives: body.nextObjectives });
          return { ok:true, nextPeriod, entryId:r.entryId };
        }
        return { ok:true, nextPeriod, needsObjectives:true };
      }
      case "finalizeCycle": {
        const cycle = db.cycles.find(c=>c.CycleID===body.cycleId);
        db.finalReviews.push({ ReviewID:newId("FR"), CycleID:body.cycleId, StaffID:cycle.StaffID, Type:cycle.Type, Decision:body.decision, Summary:body.summary||"", ImprovementPlan:body.improvementPlan||"", ReviewedDate:new Date().toISOString(), ReviewedBy:"HR" });
        const S = findStaff(db, cycle.StaffID);
        if (body.decision==="Passed") { cycle.Status="Passed"; if(S) S.Status="Active"; }
        else if (body.decision==="Failed") { cycle.Status="Failed"; }
        else if (body.decision==="Extended") {
          cycle.Status="Extended";
          if (body.extendToDate) cycle.EndDate = new Date(body.extendToDate).toISOString();
          if (body.extendMonths && cycle.Type==="Probation") cycle.DurationMonths = (cycle.DurationMonths||3) + parseInt(body.extendMonths,10);
          if (S) S.Status = cycle.Type;
        }
        saveDb(db);
        return { ok:true, demoNote:"Demo mode: staff would be emailed the final decision now." };
      }
      case "addSuggestion": {
        db.suggestions.push({ ID:newId("SUG"), StaffID: body.anonymous?"Anonymous":body.staffId, StaffName: body.anonymous?"Anonymous":body.staffName, Text:body.text, Category:body.category||"General", Date:new Date().toISOString() });
        saveDb(db); return { ok:true };
      }
      case "saveYearly": {
        let rec = db.yearly.find(Y=>Y.StaffID===body.staffId && String(Y.Year)===String(body.year));
        if (!rec) { rec={}; db.yearly.push(rec); }
        Object.assign(rec, { StaffID:body.staffId, Year:body.year, Department:body.department, SalesTotal:body.salesTotal||"", Summary:body.summary||"", Score:body.score||"", Eligible:body.eligible });
        saveDb(db); return { ok:true };
      }
      case "declareBestPerformer": {
        const yearly = db.yearly.filter(Y=>String(Y.Year)===String(body.year) && Y.Eligible);
        const byDept = {};
        yearly.forEach(Y=>{ if(!byDept[Y.Department] || parseFloat(Y.Score)>parseFloat(byDept[Y.Department].Score)) byDept[Y.Department]=Y; });
        const winners = Object.keys(byDept).map(dept=>{ const W=byDept[dept]; const S=findStaff(db,W.StaffID); return { department:dept, staffId:W.StaffID, name:S?S.Name:W.StaffID, score:W.Score }; });
        return { winners };
      }
      case "updateConfig": { db.config[body.key]=body.value; saveDb(db); return { ok:true }; }
      default: return { error: "Unknown demo action " + action };
    }
  }

  return {
    get: (action, params) => DEMO_MODE ? demoHandle(action, params||{}) : realGet(action, params),
    post: (action, body) => DEMO_MODE ? demoHandlePost(action, body||{}) : realPost(action, body),
    resetDemo: () => { localStorage.removeItem(DB_KEY); location.reload(); }
  };
})();
