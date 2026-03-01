export const Q5_TEMPLATE_ENTRY_ID = "template-bl21-de3-transformation-v1";

export const Q5_TEMPLATE_ENTRY = {
  id: Q5_TEMPLATE_ENTRY_ID,
  title: "Template: BL21(DE3) Transformation — NEB C2527H",
  description: "Heat-shock transformation of BL21(DE3) competent cells. Clone before editing for an experiment.",
  technique: "Cloning",
  body: `<h2>BL21(DE3) Transformation — NEB C2527H</h2>
<p><strong>Purpose:</strong> Transform BL21(DE3) competent cells with plasmid DNA for protein expression using heat shock methodology.</p>
<p><strong>Cells:</strong> NEB BL21(DE3) Competent Cells (C2527H, stored at −80°C)</p>

<h3>Materials</h3>
<ul>
  <li>BL21(DE3) competent cells (NEB C2527H, −80°C)</li>
  <li>Plasmid DNA (1–50 ng; avoid exceeding 10% of cell volume)</li>
  <li>SOC medium (room temperature)</li>
  <li>LB agar plates with appropriate antibiotic selection</li>
  <li>Ice bath and 42°C water bath</li>
</ul>

<h3>Preparation</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">
    <label><input type="checkbox"><span></span></label>
    <div><p>Pre-warm SOC medium to room temperature. Set 42°C water bath. Prepare ice bath.</p></div>
  </li>
  <li data-type="taskItem" data-checked="false">
    <label><input type="checkbox"><span></span></label>
    <div><p>Remove BL21(DE3) cells from −80°C and thaw on ice. Do not thaw at room temperature.</p><p><span data-entry-node="timer" label="Cell thaw on ice" seconds="1800"></span></p></div>
  </li>
  <li data-type="taskItem" data-checked="false">
    <label><input type="checkbox"><span></span></label>
    <div><p>Label tubes for each transformation. Keep cells on ice throughout procedure.</p></div>
  </li>
</ul>

<h3>Transformation</h3>
<p>
  <span data-entry-node="measurement" label="Plasmid DNA amount" unit="ng" value=""></span>
  <span data-entry-node="measurement" label="Competent cell volume" unit="µL" value="50"></span>
</p>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">
    <label><input type="checkbox"><span></span></label>
    <div><p>Add 1–50 ng plasmid DNA to 50 µL thawed competent cells. Mix gently by stirring with pipette tip — do not vortex or pipette vigorously.</p></div>
  </li>
  <li data-type="taskItem" data-checked="false">
    <label><input type="checkbox"><span></span></label>
    <div><p>Incubate on ice for 30 minutes. Cells must remain on ice.</p><p><span data-entry-node="timer" label="Ice incubation (DNA + cells)" seconds="1800"></span></p></div>
  </li>
</ul>

<h3>Heat Shock</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">
    <label><input type="checkbox"><span></span></label>
    <div><p>Place tube in 42°C water bath for exactly 30–45 seconds. Timing is critical — do not exceed 45 s.</p><p><span data-entry-node="timer" label="Heat shock at 42°C" seconds="42"></span></p></div>
  </li>
  <li data-type="taskItem" data-checked="false">
    <label><input type="checkbox"><span></span></label>
    <div><p>Immediately return tube to ice. Incubate for at least 5 minutes.</p><p><span data-entry-node="timer" label="Post-heat-shock ice step" seconds="300"></span></p></div>
  </li>
</ul>

<h3>Recovery</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">
    <label><input type="checkbox"><span></span></label>
    <div><p>Add 950 µL room-temperature SOC medium to the cells.</p></div>
  </li>
  <li data-type="taskItem" data-checked="false">
    <label><input type="checkbox"><span></span></label>
    <div><p>Incubate at 37°C for 60 minutes with gentle shaking (~250 rpm).</p><p><span data-entry-node="timer" label="SOC outgrowth at 37°C" seconds="3600"></span></p></div>
  </li>
  <li data-type="taskItem" data-checked="false">
    <label><input type="checkbox"><span></span></label>
    <div><p>Plate 100–200 µL on selective LB agar plates. Record antibiotic, plate ID, and volume plated.</p><p><span data-entry-node="measurement" label="Volume plated" unit="µL" value=""></span></p></div>
  </li>
  <li data-type="taskItem" data-checked="false">
    <label><input type="checkbox"><span></span></label>
    <div><p>Incubate plates overnight at 37°C (16–18 hours). Record antibiotic and plate ID in notes.</p></div>
  </li>
</ul>

<h3>Next-Day Assessment</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">
    <label><input type="checkbox"><span></span></label>
    <div><p>Count colonies and photograph plates. Record colony count and morphology.</p><p><span data-entry-node="measurement" label="Colony count" unit="" value=""></span></p></div>
  </li>
  <li data-type="taskItem" data-checked="false">
    <label><input type="checkbox"><span></span></label>
    <div><p>Pick colonies for overnight culture. Verify insert by colony PCR or miniprep + diagnostic digest before scaling up expression.</p></div>
  </li>
</ul>

<h3>Notes</h3>
<ul>
  <li>Heat shock duration and temperature are critical for transformation efficiency</li>
  <li>Keep cells on ice at all times except during the 42°C step</li>
  <li>For low-copy or large plasmids (&gt;10 kb), extend SOC outgrowth to 90 minutes</li>
  <li>NEB C2527H: ~10⁶ cfu/µg efficiency with pUC19 — efficiency varies with insert size and plasmid quality</li>
  <li>Confirm clone sequence before scaling up expression</li>
</ul>

<h3>Template Guidance</h3>
<p>This is a permanent reference template. Clone it before running an actual experiment so the baseline stays unchanged.</p>`,
} as const;
