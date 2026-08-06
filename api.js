/*******************************************************************
 * API LAYER
 * Real mode  -> calls the Apps Script Web App (APPS_SCRIPT_URL)
 * Demo mode  -> simulates the same API using localStorage so you
 *               can click through the whole system before deploying
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
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight on Apps Script
      body: JSON.stringify(Object.assign({ action }, body || {}))
    });
    return res.json();
  }

  /* ---------------- DEMO MODE ---------------- */
  const DB_KEY = "appraisal_demo_db_v1";

  function seed() {
    return {
      config: { HR_CONSOLE_PIN: "2580", COMPANY_NAME: "FloorKraft Limited (DEMO)", MONTHLY_REMINDER_DAY: "28", HR_NOTIFY_EMAIL: "hr@demo.local" },
      staff: [
        { StaffID: "EMP001", Name: "Amaka Obi", Email: "amaka@demo.local", Department: "Sales", JobTitle: "Sales Executive", Role: "Staff", PIN: "1111", JoinDate: "2025-02-01", Status: "Active", ManagerEmail: "manager@demo.local", Active: true },
        { StaffID: "EMP002", Name: "Tunde Bello", Email: "tunde@demo.local", Department: "Operations", JobTitle: "Installer", Role: "Staff", PIN: "2222", JoinDate: "2025-05-01", Status: "PIP", ManagerEmail: "manager@demo.local", Active: true },
        { StaffID: "HR001", Name: "Jennifer (HR)", Email: "hr@demo.local", Department: "HR", JobTitle: "Chief Success Officer", Role: "HR", PIN: "9999", JoinDate: "2024-01-01", Status: "Active", ManagerEmail: "", Active: true }
      ],
      kpiTemplates: [
        { TemplateID: "K1", Department: "Sales", Objective: "Revenue Growth", KeyResult: "Achieve monthly sales target", Unit: "₦", DefaultWeight: 40 },
        { TemplateID: "K2", Department: "Sales", Objective: "New Client Acquisition", KeyResult: "Number of new clients onboarded", Unit: "Count", DefaultWeight: 30 },
        { TemplateID: "K3", Department: "All", Objective: "Punctuality & Reporting", KeyResult: "Weekly reports submitted on time", Unit: "%", DefaultWeight: 15 },
        { TemplateID: "K4", Department: "Operations", Objective: "Installation Quality", KeyResult: "Jobs completed without rework", Unit: "%", DefaultWeight: 40 }
      ],
      monthly: [],
      probation: [],
      probationEntries: [],
      pip: [
        { PIPID: "PIP-DEMO1", StaffID: "EMP002", StartDate: "2026-06-01", EndDate: "2026-07-31", Reason: "Below target for 2 consecutive months", Status: "Extended", Notes: "Failed initial PIP review on 2026-07-31; extended by 30 days per HR decision." }
      ],
      pipEntries: [
        { EntryID: "PW-DEMO1", PIPID: "PIP-DEMO1", StaffID: "EMP002", WeekEnding: "2026-07-04", ObjectivesJSON: JSON.stringify([{objective:"Installation Quality",keyResult:"Jobs completed without rework",unit:"%",weight:100,target:90,actual:70,achv:77.8}]), EmployeeReport: "Completed 7 jobs, 2 needed rework.", ManagerComments: "Below target, needs supervision on measurement step.", ImprovementPlan: "Pair with senior installer for next 2 weeks.", Status: "Reviewed", OverallScore: 77.8, SubmittedDate: "2026-07-05", CommentedDate: "2026-07-06" }
      ],
      yearly: [],
      suggestions: [],
      audit: []
    };
  }

  function loadDb() {
    let db = JSON.parse(localStorage.getItem(DB_KEY) || "null");
    if (!db) { db = seed(); localStorage.setItem(DB_KEY, JSON.stringify(db)); }
    return db;
  }
  function saveDb(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  function newId(prefix) { return prefix + "-" + Date.now() + Math.floor(Math.random()*90+10); }

  function computeObjectives(objectives) {
    let weightedScore = 0;
    const out = (objectives||[]).map(o => {
      const target = parseFloat(o.target) || 0;
      const actual = parseFloat(o.actual) || 0;
      let achv = target !== 0 ? (actual/target*100) : 0;
      achv = Math.round(achv*10)/10;
      const weight = parseFloat(o.weight) || 0;
      weightedScore += achv * weight/100;
      return Object.assign({}, o, { achv });
    });
    return { objectives: out, overallScore: Math.round(weightedScore*10)/10 };
  }

  function findStaff(db, id) { return db.staff.find(s => s.StaffID === id); }

  async function demoHandle(action, params) {
    const db = loadDb();
    switch (action) {
      case "login": {
        const s = db.staff.find(x => x.StaffID === params.staffId && x.PIN === params.pin);
        if (!s) return { error: "Invalid ID or PIN" };
        const copy = Object.assign({}, s); delete copy.PIN;
        return { staff: copy };
      }
      case "hrPinCheck": return { ok: params.pin === db.config.HR_CONSOLE_PIN };
      case "staffList": return db.staff.map(s => { const c=Object.assign({},s); delete c.PIN; return c; });
      case "kpiTemplates": return db.kpiTemplates.filter(k => !params.department || k.Department === params.department || k.Department === "All");
      case "config": { const c=Object.assign({},db.config); delete c.HR_CONSOLE_PIN; return c; }
      case "staffDashboard": {
        const staff = Object.assign({}, findStaff(db, params.staffId)); delete staff.PIN;
        const monthly = db.monthly.filter(m => m.StaffID === params.staffId).map(m => Object.assign({}, m, { ObjectivesJSON: JSON.parse(m.ObjectivesJSON||"[]") }));
        const probation = db.probation.find(p => p.StaffID === params.staffId && p.Status === "Active") || null;
        const probationEntries = probation ? db.probationEntries.filter(e => e.ProbationID === probation.ProbationID).map(e => Object.assign({}, e, { ObjectivesJSON: JSON.parse(e.ObjectivesJSON||"[]") })) : [];
        const pip = db.pip.find(p => p.StaffID === params.staffId && (p.Status === "Active" || p.Status === "Extended")) || null;
        const pipEntries = pip ? db.pipEntries.filter(e => e.PIPID === pip.PIPID).map(e => Object.assign({}, e, { ObjectivesJSON: JSON.parse(e.ObjectivesJSON||"[]") })) : [];
        return { staff, monthly, probation, probationEntries, pip, pipEntries, kpiTemplates: db.kpiTemplates.filter(k=>k.Department===staff.Department||k.Department==="All") };
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
        saveDb(db); return { ok:true, staffId:id, demoNote:"Demo mode: no real email sent." };
      }
      case "updateStaff": {
        Object.assign(findStaff(db, body.staffId), body.patch); saveDb(db); return { ok:true };
      }
      case "addKpiTemplate": {
        db.kpiTemplates.push({ TemplateID:newId("K"), Department:body.department, Objective:body.objective, KeyResult:body.keyResult, Unit:body.unit, DefaultWeight:body.weight });
        saveDb(db); return { ok:true };
      }
      case "submitMonthly": {
        const calc = computeObjectives(body.objectives);
        let rec = db.monthly.find(m => m.StaffID===body.staffId && m.Month===body.month && String(m.Year)===String(body.year));
        if (!rec) { rec = { AppraisalID:newId("APR"), ManagerComments:"", ImprovementPlan:"", CommentedDate:"", SignedDate:"" }; db.monthly.push(rec); }
        Object.assign(rec, { StaffID:body.staffId, Month:body.month, Year:body.year, ObjectivesJSON:JSON.stringify(calc.objectives), EmployeeReport:body.employeeReport, Status:"Submitted", OverallScore:calc.overallScore, SubmittedDate:new Date().toISOString() });
        saveDb(db); return { ok:true, overallScore: calc.overallScore, demoNote:"Demo mode: HR would be notified by email in the live system." };
      }
      case "hrCommentMonthly": {
        const rec = db.monthly.find(m => m.AppraisalID===body.appraisalId);
        Object.assign(rec, { ManagerComments:body.comments, ImprovementPlan:body.improvementPlan||"", Status:"Reviewed", CommentedDate:new Date().toISOString() });
        saveDb(db); return { ok:true, demoNote:"Demo mode: staff would receive an email with their result now." };
      }
      case "hrSignOffMonthly": {
        const rec = db.monthly.find(m => m.AppraisalID===body.appraisalId);
        rec.Status = "Signed"; rec.SignedDate = new Date().toISOString();
        saveDb(db); return { ok:true, demoNote:"Demo mode: staff would receive the signed-off result + improvement plan by email now." };
      }
      case "addProbation": {
        const id = body.probationId || newId("PROB");
        db.probation.push({ ProbationID:id, StaffID:body.staffId, StartDate:body.startDate, OriginalEndDate:body.originalEndDate, ExtendedEndDate:body.extendedEndDate||"", Status:body.status||"Active", Notes:body.notes||"" });
        const s = findStaff(db, body.staffId); if (s) s.Status = "Probation";
        saveDb(db); return { ok:true, probationId:id };
      }
      case "editProbation": {
        const rec = db.probation.find(p => p.ProbationID===body.probationId);
        Object.assign(rec, body.patch);
        if (body.patch.Status && body.patch.Status !== "Active") { const s=findStaff(db, rec.StaffID); if(s) s.Status = body.patch.Status==="Passed" ? "Active" : body.patch.Status; }
        saveDb(db); return { ok:true };
      }
      case "submitProbationEntry": {
        const calc = computeObjectives(body.objectives);
        let rec = db.probationEntries.find(e => e.ProbationID===body.probationId && e.Month===body.month && String(e.Year)===String(body.year));
        if (!rec) { rec = { EntryID:newId("PE"), ManagerComments:"", ImprovementPlan:"", CommentedDate:"" }; db.probationEntries.push(rec); }
        Object.assign(rec, { ProbationID:body.probationId, StaffID:body.staffId, Month:body.month, Year:body.year, ObjectivesJSON:JSON.stringify(calc.objectives), EmployeeReport:body.employeeReport, Status:"Submitted", OverallScore:calc.overallScore, SubmittedDate:new Date().toISOString() });
        saveDb(db); return { ok:true, overallScore: calc.overallScore };
      }
      case "hrReviewProbationEntry": {
        const rec = db.probationEntries.find(e => e.EntryID===body.entryId);
        Object.assign(rec, { ManagerComments:body.comments, ImprovementPlan:body.improvementPlan||"", Status:"Reviewed", CommentedDate:new Date().toISOString() });
        saveDb(db); return { ok:true };
      }
      case "addPip": {
        const id = body.pipId || newId("PIP");
        db.pip.push({ PIPID:id, StaffID:body.staffId, StartDate:body.startDate, EndDate:body.endDate, Reason:body.reason||"", Status:body.status||"Active", Notes:body.notes||"" });
        const s = findStaff(db, body.staffId); if (s) s.Status = "PIP";
        saveDb(db); return { ok:true, pipId:id };
      }
      case "editPip": {
        const rec = db.pip.find(p => p.PIPID===body.pipId);
        Object.assign(rec, body.patch);
        if (body.patch.Status && body.patch.Status !== "Active") { const s=findStaff(db, rec.StaffID); if(s) s.Status = body.patch.Status==="Passed" ? "Active" : body.patch.Status; }
        saveDb(db); return { ok:true };
      }
      case "submitPipEntry": {
        const calc = computeObjectives(body.objectives);
        let rec = body.entryId ? db.pipEntries.find(e => e.EntryID===body.entryId) : db.pipEntries.find(e => e.PIPID===body.pipId && e.WeekEnding===body.weekEnding);
        if (!rec) { rec = { EntryID:newId("PW"), ManagerComments:"", ImprovementPlan:"", CommentedDate:"" }; db.pipEntries.push(rec); }
        Object.assign(rec, { PIPID:body.pipId, StaffID:body.staffId, WeekEnding:body.weekEnding, ObjectivesJSON:JSON.stringify(calc.objectives), EmployeeReport:body.employeeReport, Status:"Submitted", OverallScore:calc.overallScore, SubmittedDate:new Date().toISOString() });
        saveDb(db); return { ok:true, overallScore: calc.overallScore };
      }
      case "hrReviewPipEntry": {
        const rec = db.pipEntries.find(e => e.EntryID===body.entryId);
        Object.assign(rec, { ManagerComments:body.comments, ImprovementPlan:body.improvementPlan||"", Status:"Reviewed", CommentedDate:new Date().toISOString() });
        saveDb(db); return { ok:true };
      }
      case "addSuggestion": {
        db.suggestions.push({ ID:newId("SUG"), StaffID: body.anonymous?"Anonymous":body.staffId, StaffName: body.anonymous?"Anonymous":body.staffName, Text:body.text, Category:body.category||"General", Date:new Date().toISOString() });
        saveDb(db); return { ok:true };
      }
      case "saveYearly": {
        let rec = db.yearly.find(y => y.StaffID===body.staffId && String(y.Year)===String(body.year));
        if (!rec) { rec = {}; db.yearly.push(rec); }
        Object.assign(rec, { StaffID:body.staffId, Year:body.year, Department:body.department, SalesTotal:body.salesTotal||"", Summary:body.summary||"", Score:body.score||"", Eligible: body.eligible });
        saveDb(db); return { ok:true };
      }
      case "declareBestPerformer": {
        const yearly = db.yearly.filter(y => String(y.Year)===String(body.year) && y.Eligible);
        const byDept = {};
        yearly.forEach(y => { if (!byDept[y.Department] || parseFloat(y.Score) > parseFloat(byDept[y.Department].Score)) byDept[y.Department] = y; });
        const winners = Object.keys(byDept).map(dept => { const w=byDept[dept]; const s=findStaff(db,w.StaffID); return { department:dept, staffId:w.StaffID, name:s?s.Name:w.StaffID, score:w.Score }; });
        return { winners };
      }
      case "updateConfig": { db.config[body.key] = body.value; saveDb(db); return { ok:true }; }
      default: return { error: "Unknown demo action " + action };
    }
  }

  return {
    get: (action, params) => DEMO_MODE ? demoHandle(action, params||{}) : realGet(action, params),
    post: (action, body) => DEMO_MODE ? demoHandlePost(action, body||{}) : realPost(action, body),
    resetDemo: () => { localStorage.removeItem(DB_KEY); location.reload(); }
  };
})();
