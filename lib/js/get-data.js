//adapted from the cerner smart on fhir guide. updated to utalize client.js v2 library and FHIR R4

// helper function to process fhir resource to get the patient name.
function getPatientName(pt) {
  if (pt.name) {
    var names = pt.name.map(function(name) {
      return name.given.join(" ") + " " + name.family;
    });
    return names.join(" / ")
  } else {
    return "anonymous";
  }
}

// display the patient name gender and dob in the index page
function displayPatient(pt) {
  document.getElementById('patient_name').innerHTML = getPatientName(pt);
  document.getElementById('gender').innerHTML = pt.gender;
  document.getElementById('dob').innerHTML = pt.birthDate;
}

//function to display list of medications
function displayMedication(meds) {
  med_list.innerHTML += "<li> " + meds + "</li>";
}

//helper function to get quantity and unit from an observation resource.
function getQuantityValueAndUnit(ob) {
  if (typeof ob != 'undefined' &&
    typeof ob.valueQuantity != 'undefined' &&
    typeof ob.valueQuantity.value != 'undefined' &&
    typeof ob.valueQuantity.unit != 'undefined') {
    return Number(parseFloat((ob.valueQuantity.value)).toFixed(2)) + ' ' + ob.valueQuantity.unit;
  } else {
    return undefined;
  }
}

function getQuantityValue(ob) {
  if (typeof ob != 'undefined' &&
    typeof ob.valueQuantity != 'undefined' &&
    typeof ob.valueQuantity.value != 'undefined') {
    return Number(parseFloat((ob.valueQuantity.value)).toFixed(2));
  } else {
    return undefined;
  }
}

// helper function to get both systolic and diastolic bp
function getBloodPressureValues(BPObservations, typeOfPressure) {
  var formattedBPObservations = [];
  BPObservations.forEach(function(observation) {
    var BP = observation.component.find(function(component) {
      return component.code.coding.find(function(coding) {
        return coding.code == typeOfPressure;
      });
    });
    if (BP) {
      observation.valueQuantity = BP.valueQuantity;
      formattedBPObservations.push({...observation});
    }
  });

  return formattedBPObservations;
}

// create a patient object to initialize the patient
function defaultPatient() {
  return {
    height: {
      value: ''
    },
    weight: {
      value: ''
    },
    sys: {
      value: ''
    },
    dia: {
      value: ''
    },
    ldl: {
      value: ''
    },
    hdl: {
      value: ''
    },
    bmi: {
      value: ''
    },
    note: 'No Annotation',
  };
}

//helper function to display the annotation on the index page
function displayAnnotation(annotation) {
  note.innerHTML = `${annotation.time},${annotation.authorString},${annotation.text}`;
}

//function to display the observation values you will need to update this
function displayObservation(pat) {
  hdl.innerHTML = pat.hdl;
  ldl.innerHTML = pat.ldl;
  sys.innerHTML = pat.sys;
  dia.innerHTML = pat.dia;
  height.innerHTML = pat.height;
  weight.innerHTML = pat.weight;
  bmi.innerHTML = pat.bmi;
}

function displayChart(container, yAxis, name, series, plotBands = []){
  return Highcharts.chart(container, {
    chart: {
      type: 'spline'
    },

    credits: {
      enabled: false
    },

    tooltip: {
      shared: true
    },

    title: {
        text: `Patient ${name}`
    },

    yAxis: {
        title: {
            text: yAxis
        },
      plotBands
    },

    xAxis: {
      type: 'datetime',
      labels: {
        overflow: 'justify'
      },
      // dateTimeLabelFormats: { // don't display the dummy year
      //     month: '%e. %b',
      //     year: '%b'
      // },
      title: {
          text: 'Date'
      }
  },

    legend: {
        layout: 'vertical',
        align: 'right',
        verticalAlign: 'middle'
    },

    plotOptions: {
      series: {
          marker: {
              enabled: true
          }
      }
  },

    series,

    responsive: {
        rules: [{
            condition: {
                maxWidth: 500
            },
            chartOptions: {
                legend: {
                    layout: 'horizontal',
                    align: 'center',
                    verticalAlign: 'bottom'
                }
            }
        }]
    }

});

}

//once fhir client is authorized then the following functions can be executed
// const clientProm = FHIR.oauth2.ready();
const clientProm = new Promise((resolve,reject)=>{
  resolve(new FHIR.client({
    serverUrl: "https://r4.smarthealthit.org",
    tokenResponse: {
      patient: "a6889c6d-6915-4fac-9d2f-fc6c42b3a82e"
    }
  }));
});

clientProm.then(client => {
  // get patient object and then display its demographics info in the banner
  client.request(`Patient/${client.patient.id}`).then(
    function(patient) {
      displayPatient(patient);
      console.log(patient);
    }
  );

  function dateFromEffective(effective) {
    effectiveDate = new Date(effective);
    return Highcharts.time.Date.UTC(effectiveDate.getFullYear(),effectiveDate.getMonth(), effectiveDate.getDate())
  }

  var weightChart,
  heightChart,
  hdlChart,
  ldlChart,
  bmiChart,
  bpChart;

  // get observation resource values
  // you will need to update the below to retrieve the weight and height values
  var query = new URLSearchParams();

  query.set("patient", client.patient.id);
  query.set("_count", 100);
  query.set("_sort", "-date");
  query.set("code", [
    'http://loinc.org|8462-4', // diastolic bp
    'http://loinc.org|8480-6', // systolic bp
    'http://loinc.org|2085-9', // hdl
    'http://loinc.org|2089-1', // ldl
    'http://loinc.org|55284-4', // blood pressures
    'http://loinc.org|3141-9', // Weight
    'http://loinc.org|29463-7', // weight
    'http://loinc.org|8302-2', // height
    'http://loinc.org|39156-5', // bmi
  ].join(","));

  client.request("Observation?" + query, {
    pageLimit: 0,
    flat: true
  }).then(
    function(ob) {
  
      // group all of the observation resources by type into their own
      var byCodes = client.byCodes(ob, 'code');
      var systolicbps = getBloodPressureValues(byCodes('55284-4'), '8480-6');
      var diastolicbps = getBloodPressureValues(byCodes('55284-4'), '8462-4');
      var hdl = byCodes('2085-9');
      var ldl = byCodes('2089-1');
      var weights = byCodes('29463-7');
      var heights = byCodes('8302-2');
      var bmis = byCodes('39156-5');
  
      // create patient object
      var p = defaultPatient();
  
      var systolicbp = getQuantityValueAndUnit(systolicbps[0]),
      diastolicbp = getQuantityValueAndUnit(diastolicbps[0])

      // set patient value parameters to the data pulled from the observation resource
      if (typeof systolicbp != 'undefined') {
        p.sys = systolicbp;
      } else {
        p.sys = 'undefined'
      }
  
      if (typeof diastolicbp != 'undefined') {
        p.dia = diastolicbp;
      } else {
        p.dia = 'undefined'
      }
  
      p.hdl = getQuantityValueAndUnit(hdl[0]);
      p.ldl = getQuantityValueAndUnit(ldl[0]);
      p.weight = getQuantityValueAndUnit(weights[0]);
      p.height = getQuantityValueAndUnit(heights[0]);
      p.bmi = getQuantityValueAndUnit(bmis[0]);
  
      // set latest annotation if one already exists
      if (p.weight?.note?.[0]) displayAnnotation(p.weight.note[0]);

      displayObservation(p);

      var dedupAndPair = items => Object.values(
        items
        // map vitals to time value pairs
        .map(item => [dateFromEffective(item.effectiveDateTime), getQuantityValue(item)])
        // remove items on the same day, taking the more recent one (sorted descending)
        .reduce((prev, curr)=> {
          if (!prev[curr[0].toString()])
            prev[curr[0].toString()] = curr;
          return prev;
        }, {})
      )
      .sort((l,r)=>l[0]-r[0]);

      heights = {name: "height", data: dedupAndPair(heights)};
      weights = {name: "weight", data: dedupAndPair(weights)};

      // add randomness for the sake of graphical testing
      // heights.data = heights.data.map(x=> {x[1]+= Math.round(Math.random()*10)-5; return x;})
      // weights.data = weights.data.map(x=> {x[1] += Math.round(Math.random()*10)-5; return x;})

      hdl = {name: "hdl", data: dedupAndPair(hdl)};
      ldl = {name: "ldl", data: dedupAndPair(ldl)};
      systolicbps = {name: "systolic", data: dedupAndPair(systolicbps)};
      diastolicbps = {name: "diastolic", data: dedupAndPair(diastolicbps)};
      bmis = {name: "bmi", data: dedupAndPair(bmis)};
      // bmi.data = bmi.data.map(x=> {x[1] += Math.round(Math.random()*10)-5; return x;})

      var low = "rgba(68, 170, 213, 0.1)",
      normal = "rgba(0, 170, 0, 0.1)",
      elevated = "rgba(250, 212, 42, 0.1)",
      very_high = "rgba(145, 45, 45, 0.1)",
      medium = "rgba(245, 188, 66, 0.1)",
      high = "rgba(250, 42, 42, 0.1)";

      var bpBands = [
        {
          from: 120,
          to: 100,
          color: normal,
          label: {
              text: 'Normal Systolic',
              style: {
                  color: '#606060'
              }
          }
      },
      { 
        from: 120,
        to: 129,
        color: elevated,
        label: {
            text: 'Pre-hypertension Systolic',
            style: {
                color: '#606060'
            }
        }
    },
    { 
      from: 130,
      to: 220,
      color: high,
      label: {
          text: 'Hypertension Systolic',
          style: {
              color: '#606060'
          }
      }
    },
      { 
        from: 80,
        to: 100,
        color: high,
        label: {
            text: 'Hypertension Diastolic',
            style: {
                color: '#606060'
            }
      }
    },
    { 
      from: 0,
      to: 80,
      color: normal,
      label: {
          text: 'Normal Diastolic',
          style: {
              color: '#606060'
          }
    }
  }
      ];

      //calculate bmi over time
      // chart with plot bands for over/under weight and obese etc.
      var bmiBands = [
        {
          from: 0,
          to: 18.5,
          color: low,
          label: {
              text: 'Underweight',
              style: {
                  color: '#606060'
              }
          }
      },
      {
        from: 18.5,
        to: 24.9,
        color: normal,
        label: {
            text: 'Healthy Weight',
            style: {
                color: '#606060'
            }
        }
    },
    {
      from: 25,
      to: 29.9,
      color: elevated,
      label: {
          text: 'Overweight',
          style: {
              color: '#606060'
          }
      }
  },
  {
    from: 30,
    to: 80,
    color: high,
    label: {
        text: 'Obese',
        style: {
            color: '#606060'
        }
    }
}
];

var hdlBands = [
  {
    from: 0,
    to: 40,
    color: low,
    label: {
        text: 'Low',
        style: {
            color: '#606060'
        }
    }
},
{ 
  from: 60,
  to: 100,
  color: normal,
  label: {
      text: 'Good',
      style: {
          color: '#606060'
      }
  }
}
];
var ldlBands = [
  {
    from: 0,
    to: 100,
    color: normal,
    label: {
        text: 'Optimal',
        style: {
            color: '#606060'
        }
    }
},
{ 
  from: 100,
  to: 129,
  color: elevated,
  label: {
      text: 'Near Optimal',
      style: {
          color: '#606060'
      }
  }
},
{ 
  from: 130,
  to: 159,
  color: medium,
  label: {
      text: 'Borderline High',
      style: {
          color: '#606060'
      }
  }
},
{ 
  from: 160,
  to: 189,
  color: high,
  label: {
      text: 'High',
      style: {
          color: '#606060'
      }
  }
},
{ 
  from: 190,
  to: 300,
  color: very_high,
  label: {
      text: 'Very High',
      style: {
          color: '#606060'
      }
  }
}
];

      // chart available vitals
      //? only chart for a set period, like past month? would keep the scale consistent between charts
      heightChart = displayChart("height-container", "height (cm)", "height", [heights]);
      weightChart = displayChart("weight-container", "weight (kg)", "weight", [weights]);
      hdlChart = displayChart("hdl-container", "mg/dL", "hdl", [hdl], hdlBands);
      ldlChart = displayChart("ldl-container", "mg/dL", "ldl", [ldl], ldlBands);
      bpChart = displayChart("bp-container", "Blood Pressure (mmHg)", "Blood Pressure", [systolicbps, diastolicbps], bpBands);
      bmiChart = displayChart("bmi-container", "BMI (kg/m^2)", "Body Mass Index", [bmis], bmiBands);
      
    });

function addHeight(){
  var value = document.getElementById("add-height").value,
    effectiveDate = new Date(),
    // based on https://www.hl7.org/fhir/observation-example.json.html and retrieve measurements
    obv = {
      "resourceType": "Observation",
      "id": "example",
      "status": "final",
      "category": [
        {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/observation-category",
              "code": "vital-signs",
              "display": "Vital Signs"
            }
          ]
        }
      ],
      "code": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": '8302-2',
            "display": "Body Height"
          }
        ]
      },
      "subject": {
        "reference": `Patient/${client.patient.id}`
      },
      "effectiveDateTime": effectiveDate.toISOString(),
      "valueQuantity": {
        "value": value,
        "unit": "cm",
        "system": "http://unitsofmeasure.org",
        "code": "cm"
      }
    };

    client.create(obv)
    .then(
      x => {
        console.log(x);
        // update displayed weight
        height.innerHTML = `${value} cm`

        if (!heightChart.series[0]){
          heightChart.series[0] = new Series();
        }

        // append to chart
        // may need to edit point instead of appending
        var effectiveDate = dateFromEffective(new Date());
        var existing = heightChart.series[0].data.findIndex(x=>x.category == effectiveDate);
        if (existing > -1){ // replacing measurement for day
          heightChart.series[0].removePoint(existing);
        }
        heightChart.series[0].addPoint([effectiveDate, parseFloat(value)]);

        // also create bmi obv and update chart, if applicable
        addBMI();
        // this will be the same when adding a height
      },
      x=>
      console.error(x));
}
function addBMI(){
  var value = calculateBMI(),
    effectiveDate = new Date(),
    effectiveLookupDate = dateFromEffective(new Date());

    if (!(heightChart.series[0].data.find(x=>x.category == effectiveLookupDate) &&
    weightChart.series[0].data.find(x=>x.category == effectiveLookupDate))){
      //no need to alert, as the user did not specific try to do this
      return;
    }

    // based on https://www.hl7.org/fhir/observation-example.json.html and retrieve measurements
    var obv = {
      "resourceType": "Observation",
      "id": "example",
      "status": "final",
      "category": [
        {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/observation-category",
              "code": "vital-signs",
              "display": "Vital Signs"
            }
          ]
        }
      ],
      "code": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": '39156-5',
            "display": 'Body Mass Index'
          }
        ]
      },
      "subject": {
        "reference": `Patient/${client.patient.id}`
      },
      "effectiveDateTime": effectiveDate.toISOString(),
      "valueQuantity": {
        "value": value,
        "unit": 'kg/m2',
        "system": "http://unitsofmeasure.org",
        "code": 'kg/m2'
      }
    };

    client.create(obv)
    .then(
      x => {
        console.log(x);

        if (!bmiChart.series[0]){
          bmiChart.series[0] = new Series();
        }

        var effectiveDate = dateFromEffective(new Date());
        var existing = bmiChart.series[0].data.findIndex(x=>x.category == effectiveDate);
        if (existing > -1){ // replacing measurement for day
          bmiChart.series[0].removePoint(existing);
        }
        bmiChart.series[0].addPoint([effectiveDate, parseFloat(value)]);
      },
      x=>
      console.error(x));
}
function calculateBMI(){
  //weight (kg) / (height(cm)/100)^2
  return +(parseFloat(weight.innerHTML.split(" ")[0])/((parseFloat(height.innerHTML.split(" ")[0])/100)**2)).toFixed(2);
}
function addLDL(){
  var value = document.getElementById("add-ldl").value,
    effectiveDate = new Date(),
    // based on https://www.hl7.org/fhir/observation-example.json.html and retrieve measurements
    obv = {
      "resourceType": "Observation",
      "id": "example",
      "status": "final",
      "category": [
        {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/observation-category",
              "code": "vital-signs",
              "display": "Vital Signs"
            }
          ]
        }
      ],
      "code": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": "2089-1",
            "display": "Low Density Lipoprotein Cholesterol"
          }
        ]
      },
      "subject": {
        "reference": `Patient/${client.patient.id}`
      },
      "effectiveDateTime": effectiveDate.toISOString(),
      "valueQuantity": {
        "value": value,
        "unit": 'mg/dL',
        "system": "http://unitsofmeasure.org",
        "code": 'mg/dL'
      }
    };

    client.create(obv)
    .then(
      x => {
        console.log(x);
        // update displayed weight
        ldl.innerHTML = `${value} ml/dL`

        // append to chart
        // may need to edit point instead of appending
        var effectiveDate = dateFromEffective(new Date());

        if (!ldlChart.series[0]){
          ldlChart.series[0] = new Series();
        }

        var existing = ldlChart.series[0].data.findIndex(x=>x.category == effectiveDate);
        if (existing > -1){ // replacing measurement for day
          ldlChart.series[0].removePoint(existing);
        }
        ldlChart.series[0].addPoint([effectiveDate, parseFloat(value)]);
      },
      x=>
      console.error(x));
}
function addHDL(){
  var value = document.getElementById("add-hdl").value,
  effectiveDate = new Date(),
  // based on https://www.hl7.org/fhir/observation-example.json.html and retrieve measurements
  obv = {
    "resourceType": "Observation",
    "id": "example",
    "status": "final",
    "category": [
      {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
            "code": "vital-signs",
            "display": "Vital Signs"
          }
        ]
      }
    ],
    "code": {
      "coding": [
        {
          "system": "http://loinc.org",
          "code": '2085-9',
          "display": 'High Density Lipoprotein Cholesterol'
        }
      ]
    },
    "subject": {
      "reference": `Patient/${client.patient.id}`
    },
    "effectiveDateTime": effectiveDate.toISOString(),
    "valueQuantity": {
      "value": value,
      "unit": 'mg/dL',
      "system": "http://unitsofmeasure.org",
      "code": 'mg/dL'
    }
  };

  client.create(obv)
  .then(
    x => {
      console.log(x);
      // update displayed weight
      hdl.innerHTML = `${value} mg/dL`

      if (!hdlChart.series[0]){
        hdlChart.series[0] = new Series();
      }

      // append to chart
      // may need to edit point instead of appending
      var effectiveDate = dateFromEffective(new Date());
      var existing = hdlChart.series[0].data.findIndex(x=>x.category == effectiveDate);
      if (existing > -1){ // replacing measurement for day
        hdlChart.series[0].removePoint(existing);
      }
      hdlChart.series[0].addPoint([effectiveDate, parseFloat(value)]);
    },
    x=>
    console.error(x));
}
function addBP(){

  var sys_value = document.getElementById("add-sys-bp").value,
  dia_value = document.getElementById("add-dia-bp").value
  effectiveDate = new Date();

  if (!(sys_value && dia_value)){
    alert("both systolic and diastolic values are required to add a blood pressure");
    return;
  }

  // based on https://www.hl7.org/fhir/observation-example.json.html and retrieve measurements
  var obv = {
    "resourceType": "Observation",
    "id": "example",
    "status": "final",
    "category": [
      {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
            "code": "vital-signs",
            "display": "Vital Signs"
          }
        ]
      }
    ],
    "code": {
      "coding": [
        {
          "system": "http://loinc.org",
          "code": '55284-4',
          "display": 'Blood Pressure' 
        }
      ]
    },
    "subject": {
      "reference": `Patient/${client.patient.id}`
    },
    "effectiveDateTime": effectiveDate.toISOString(),
    "component": [
      {
        "code": {
          "coding": [
            {
              "code": '8462-4',
              "display": 'Diastolic Blood Pressure',
              "system": 'http://loinc.org'
            }
          ]
        },
        "valueQuantity": {
          "code": 'mm[Hg]',
          "system": 'http://unitsofmeasure.org',
          "unit": 'mm[Hg]',
          "value": dia_value
        }
      },
      {
        "code": {
          "coding": [
            {
              "code": '8480-6',
              "display": 'Systolic Blood Pressure',
              "system": 'http://loinc.org'
            }
          ]
        },
        "valueQuantity": {
          "code": 'mm[Hg]',
          "system": 'http://unitsofmeasure.org',
          "unit": 'mm[Hg]',
          "value": sys_value
        }
      },
    ]
  };

  client.create(obv)
  .then(
    x => {
      console.log(x);
      // update displayed weight
      sys.innerHTML = `${sys_value} mmHg`
      dia.innerHTML = `${dia_value} mmHg`

      if (!bpChart.series[0]){
        bpChart.series[0] = new Series();
      }
      if (!bpChart.series[1]){
        bpChart.series[1] = new Series();
      }

      // append to chart
      // may need to edit point instead of appending
      var effectiveDate = dateFromEffective(new Date());
      var existing = bpChart.series[0].data.findIndex(x=>x.category == effectiveDate);
      if (existing > -1){ // replacing measurement for day
        bpChart.series[0].removePoint(existing);
      }
      bpChart.series[0].addPoint([effectiveDate, parseFloat(sys_value)]);
      existing = bpChart.series[1].data.findIndex(x=>x.category == effectiveDate);
      if (existing > -1){ // replacing measurement for day
        bpChart.series[1].removePoint(existing);
      }
      bpChart.series[1].addPoint([effectiveDate, parseFloat(dia_value)]);
    },
    x=>
    console.error(x));
}

  function addWeight() {
    var value = document.getElementById("add-weight").value,
    effectiveDate = new Date(),
    // based on https://www.hl7.org/fhir/observation-example.json.html and retrieve measurements
    obv = {
      "resourceType": "Observation",
      "id": "example",
      "status": "final",
      "category": [
        {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/observation-category",
              "code": "vital-signs",
              "display": "Vital Signs"
            }
          ]
        }
      ],
      "code": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": "29463-7",
            "display": "Body Weight"
          },
          {
            "system": "http://loinc.org",
            "code": "3141-9",
            "display": "Body weight Measured"
          },
          {
            "system": "http://snomed.info/sct",
            "code": "27113001",
            "display": "Body weight"
          },
          {
            "system": "http://acme.org/devices/clinical-codes",
            "code": "body-weight",
            "display": "Body Weight"
          }
        ]
      },
      "subject": {
        "reference": `Patient/${client.patient.id}`
      },
      "effectiveDateTime": effectiveDate.toISOString(),
      "valueQuantity": {
        "value": value,
        "unit": "kg",
        "system": "http://unitsofmeasure.org",
        "code": "kg"
      }
    };

    client.create(obv)
    .then(
      x => {
        console.log(x);
        // update displayed weight
        weight.innerHTML = `${value} kg`

        if (!weightChart.series[0]){
          weightChart.series[0] = new Series();
        }

        // append to chart
        // may need to edit point instead of appending
        var effectiveDate = dateFromEffective(new Date());
        var existing = weightChart.series[0].data.findIndex(x=>x.category == effectiveDate);
        if (existing > -1){ // replacing measurement for day
          weightChart.series[0].removePoint(existing);
        }
        weightChart.series[0].addPoint([effectiveDate, parseFloat(value)]);

        // also create bmi obv and update chart, if applicable
        addBMI();
        // this will be the same when adding a height
      },
      x=>
      console.error(x));
    
  }

  document.getElementById('add-weight-button').addEventListener('click', addWeight);
  document.getElementById('add-height-button').addEventListener('click', addHeight);
  document.getElementById('add-hdl-button').addEventListener('click', addHDL);
  document.getElementById('add-ldl-button').addEventListener('click', addLDL);
  document.getElementById('add-bp-button').addEventListener('click', addBP);

});
