//adapted from the cerner smart on fhir guide. updated to utalize client.js v2 library and FHIR R4

// helper function to process fhir resource to get the patient name.
function getPatientName(pt) {
  if (pt.name) {
    var names = pt.name.map(function (name) {
      return name.given.join(" ") + " " + name.family;
    });
    return names.join(" / ")
  } else {
    return "anonymous";
  }
}

// display the patient name gender and dob in the index page
function displayPatient(pt) {
  vm.patient_name = getPatientName(pt);
  vm.patient_gender = pt.gender;
  vm.patient_dob_string = pt.birthDate;
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
  BPObservations.forEach(function (observation) {
    var BP = observation.component.find(function (component) {
      return component.code.coding.find(function (coding) {
        return coding.code == typeOfPressure;
      });
    });
    if (BP) {
      observation.valueQuantity = BP.valueQuantity;
      formattedBPObservations.push({ ...observation });
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
  vm.hdl_cholesterol = pat.hdl;
  vm.ldl_cholesterol = pat.ldl;
  vm.sys_bp = pat.sys;
  vm.dia_bp = pat.dia;
  vm.height = pat.height;
  vm.weight = pat.weight;
  vm.bmi = pat.bmi;
}

function displayChart(container, yAxis, name, series, plotBands = []) {
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

const nbsp = '\xa0';

const HIGH_SYS_BP = 130,
HIGH_DIA_BP = 80,
HIGH_LDL = 100,
HIGH_BMI = 25,
LOW_HDL = 40,
LOW_BMI = 18.5

function getFHIRClient() {
  var local = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:";
  //once fhir client is authorized then the following functions can be executed
  if (local)
    return new Promise((resolve, reject) => {
      resolve(new FHIR.client({
        serverUrl: "https://r4.smarthealthit.org",
        tokenResponse: {
          patient: "a6889c6d-6915-4fac-9d2f-fc6c42b3a82e"
        }
      }));
    });
  else
    return FHIR.oauth2.ready();

}

function populatePatient() {

  var clientProm = getFHIRClient();

  clientProm.then(client => {
    // get patient object and then display its demographics info in the banner
    client.request(`Patient/${client.patient.id}`).then(
      function (patient) {
        displayPatient(patient);
        console.log(patient);
      }
    );

    function dateFromEffective(effective) {
      effectiveDate = new Date(effective);
      return Highcharts.time.Date.UTC(effectiveDate.getFullYear(), effectiveDate.getMonth(), effectiveDate.getDate())
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
      function (ob) {

        // group all of the observation resources by type into their own
        var byCodes = client.byCodes(ob, 'code');
        var systolicbps = getBloodPressureValues(byCodes('55284-4'), '8480-6');
        var diastolicbps = getBloodPressureValues(byCodes('55284-4'), '8462-4');
        var hdl = byCodes('2085-9');
        var ldl = byCodes('2089-1');
        var weights = byCodes('29463-7');
        var heights = byCodes('8302-2');
        var bmis = byCodes('39156-5');

        var dedupByDay = items => Object.values(
          items
            // remove items on the same day, taking the more recent one (sorted descending)
            .reduce((prev, curr) => {
              if (!prev[dateFromEffective(curr.effectiveDateTime)])
                prev[dateFromEffective(curr.effectiveDateTime)] = curr;
              return prev;
            }, {})
        )
          .sort((l, r) => dateFromEffective(l.effectiveDateTime) - dateFromEffective(r.effectiveDateTime));

        heights = dedupByDay(heights);
        weights = dedupByDay(weights);

        // add randomness for the sake of graphical testing
        // heights.data = heights.data.map(x=> {x[1]+= Math.round(Math.random()*10)-5; return x;})
        // weights.data = weights.data.map(x=> {x[1] += Math.round(Math.random()*10)-5; return x;})

        hdl = dedupByDay(hdl);
        ldl = dedupByDay(ldl);
        systolicbps = dedupByDay(systolicbps);
        diastolicbps = dedupByDay(diastolicbps);
        bmis = dedupByDay(bmis);
        // bmi.data = bmi.data.map(x=> {x[1] += Math.round(Math.random()*10)-5; return x;})

        var startDate = new Date();
        if (startDate.getMonth() == 1)
          startDate.setMonth(12);
        else
          startDate.setMonth(startDate.getMonth() - 1);

        // check for high values
        // not checking full historical since having high BP 3 years ago doesn't really matter for resources now
        if (hdl?.filter(item => dateFromEffective(item.effectiveDateTime) > startDate)
          ?.some(item => getQuantityValue(item) <= LOW_HDL))
          vm.high_values.push({type: "cholesterol", name: "HDL Cholesterol", title: "Cholesterol", low_val:LOW_HDL});
        if (ldl?.filter(item => dateFromEffective(item.effectiveDateTime) > startDate)
          ?.some(item => getQuantityValue(item) >= HIGH_LDL))
          vm.high_values.push({type: "cholesterol", name: "LDL Cholesterol", title: "Cholesterol", hi_val:HIGH_LDL});
        if (systolicbps?.filter(item => dateFromEffective(item.effectiveDateTime) > startDate)
          ?.some(item => getQuantityValue(item) >= HIGH_SYS_BP))
          vm.high_values.push({type: "bp", name: "Systolic Blood Pressure", title: "Blood Pressure", hi_val:HIGH_SYS_BP});
        if (diastolicbps?.filter(item => dateFromEffective(item.effectiveDateTime) > startDate)
          ?.some(item => getQuantityValue(item) >= HIGH_DIA_BP))
          vm.high_values.push({type: "bp", name: "Diastolic Blood Pressure", title: "Blood Pressure", hi_val:HIGH_DIA_BP});
        if (bmis?.filter(item => dateFromEffective(item.effectiveDateTime) > startDate)
          ?.some(item => getQuantityValue(item) >= HIGH_BMI))
          vm.high_values.push({type: "bmi", name: "Body Mass Index", title: "Body Mass Index", hi_val:HIGH_BMI});
        if (bmis?.filter(item => dateFromEffective(item.effectiveDateTime) > startDate)
          ?.some(item => getQuantityValue(item) <= LOW_BMI))
          vm.high_values.push({type: "bmi", name: "Body Mass Index", title: "Body Mass Index", low_val:LOW_BMI});

        if (vm.high_values.length > 0){
          let body = "In the last month, you have had readings outside of the healthy range for the following vitals:<br>" +
          "<ul>\n<li>"+
          vm.high_values.map(x=>`${x.name} ${x.hi_val?`>= ${x.hi_val}`:`<= ${x.low_val}`}`).join("</li>\n<li>") +
          "</li>\n</ul><br>Check with your doctor and the provided resources to learn what you can do to manage these values.";

          vm.displayModal("Values outside healthy range", body);

          // dedup list to avoid duplication in resources page
          let high_vals_dict = vm.high_values.reduce((prev,curr)=>{if (!prev[curr.type])prev[curr.type] = curr; return prev},{})
          vm.high_values = Object.values(high_vals_dict)
        }

        // create patient object
        var p = defaultPatient();

        var getLast = list => list[list.length - 1]

        var systolicbp = getQuantityValueAndUnit(getLast(systolicbps)),
          diastolicbp = getQuantityValueAndUnit(getLast(diastolicbps))

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

        p.hdl = getQuantityValueAndUnit(getLast(hdl));
        p.ldl = getQuantityValueAndUnit(getLast(ldl));
        p.weight = getQuantityValueAndUnit(getLast(weights));
        p.height = getQuantityValueAndUnit(getLast(heights));
        p.bmi = getQuantityValueAndUnit(getLast(bmis));

        // set latest annotation if one already exists
        if (p.weight?.note?.[0]) displayAnnotation(p.weight.note[0]);

        displayObservation(p);

        var pairForCharting = items => items
            // map vitals to time value pairs
            .map(item => [dateFromEffective(item.effectiveDateTime), getQuantityValue(item)])

        heights = { name: "height", data: pairForCharting(heights) };
        weights = { name: "weight", data: pairForCharting(weights) };

        // add randomness for the sake of graphical testing
        // heights.data = heights.data.map(x=> {x[1]+= Math.round(Math.random()*10)-5; return x;})
        // weights.data = weights.data.map(x=> {x[1] += Math.round(Math.random()*10)-5; return x;})

        hdl = { name: "hdl", data: pairForCharting(hdl) };
        ldl = { name: "ldl", data: pairForCharting(ldl) };
        systolicbps = { name: "systolic", data: pairForCharting(systolicbps) };
        diastolicbps = { name: "diastolic", data: pairForCharting(diastolicbps) };
        bmis = { name: "bmi", data: pairForCharting(bmis) };
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
            from: HIGH_SYS_BP,
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
            from: HIGH_DIA_BP,
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
            to: HIGH_DIA_BP,
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
            to: LOW_BMI,
            color: low,
            label: {
              text: 'Underweight',
              style: {
                color: '#606060'
              }
            }
          },
          {
            from: LOW_BMI,
            to: 25,
            color: normal,
            label: {
              text: 'Healthy Weight',
              style: {
                color: '#606060'
              }
            }
          },
          {
            from: HIGH_BMI,
            to: 30,
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
            to: LOW_HDL,
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
            to: HIGH_LDL,
            color: normal,
            label: {
              text: 'Optimal',
              style: {
                color: '#606060'
              }
            }
          },
          {
            from: HIGH_LDL,
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

    function addHeight() {
      var value = document.getElementById("add-height").value;
      if (!value || isNaN(parseFloat(value))) {
        vm.displayModal('Invalid input', 'value must be filled out and numeric');
        return;
      }
      var effectiveDate = new Date(),
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
            vm.height = `${value} cm`

            if (!heightChart.series[0]) {
              heightChart.series[0] = new Series();
            }

            // append to chart
            // may need to edit point instead of appending
            var effectiveDate = dateFromEffective(new Date());
            var existing = heightChart.series[0].data.findIndex(x => x.category == effectiveDate);
            if (existing > -1) { // replacing measurement for day
              heightChart.series[0].removePoint(existing);
            }
            heightChart.series[0].addPoint([effectiveDate, parseFloat(value)]);

            // also create bmi obv and update chart, if applicable
            addBMI();
            // this will be the same when adding a height
          },
          x => console.error(x));
    }
    function addBMI() {
      var value = calculateBMI(),
        effectiveDate = new Date(),
        effectiveLookupDate = dateFromEffective(new Date());

      if (!(heightChart.series[0].data.find(x => x.category == effectiveLookupDate) &&
        weightChart.series[0].data.find(x => x.category == effectiveLookupDate))) {
        //no need to alert, as the user did not specific try to do this
        return;
      }

      if (value >= HIGH_BMI) {
        vm.displayModal("High BMI", "Looks like your Body Mass Index, BMI, is a bit High. Check with your doctor and look at the provided resources for tips on managing your weight.")
        
        if (!vm.high_values.some(val => val.type === "bmi"))
          vm.high_values.push({type: "bmi", name: "Body Mass Index", title: "Body Mass Index", hi_val:HIGH_BMI});
      }
      else if (value <= LOW_BMI) {
        vm.displayModal("Low BMI", "Looks like your Body Mass Index, BMI, is a bit low. Check with your doctor and look at the provided resources for tips on managing your weight.")
        
        if (!vm.high_values.some(val => val.type === "bmi"))
          vm.high_values.push({type: "bmi", name: "Body Mass Index", title: "Body Mass Index", low_val:LOW_BMI});
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
            vm.bmi = value

            if (!bmiChart.series[0]) {
              bmiChart.series[0] = new Series();
            }

            var effectiveDate = dateFromEffective(new Date());
            var existing = bmiChart.series[0].data.findIndex(x => x.category == effectiveDate);
            if (existing > -1) { // replacing measurement for day
              bmiChart.series[0].removePoint(existing);
            }
            bmiChart.series[0].addPoint([effectiveDate, parseFloat(value)]);
          },
          x => console.error(x));
    }
    function calculateBMI() {
      //weight (kg) / (height(cm)/100)^2
      return +(parseFloat(weight.innerHTML.split(" ")[0]) / ((parseFloat(height.innerHTML.split(" ")[0]) / 100) ** 2)).toFixed(2);
    }
    function addLDL() {
      var value = document.getElementById("add-ldl").value;
      if (!value || isNaN(parseFloat(value))) {
        vm.displayModal('Invalid input', 'value must be filled out and numeric');
        return;
      }

      if (value >= HIGH_LDL) {
        vm.displayModal("High LDL Cholesterol", "Looks like your LDL (bad) Cholesterol is a bit high. Check with your doctor and look at the provided resources for tips on managing your cholesterol.")
        
        if (!vm.high_values.some(val => val.type === "cholesterol"))
        vm.high_values.push({type: "cholesterol", title: "Cholesterol", hi_val:HIGH_LDL});
      }

      var effectiveDate = new Date(),
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
            vm.ldl_cholesterol = `${value} ml/dL`

            // append to chart
            // may need to edit point instead of appending
            var effectiveDate = dateFromEffective(new Date());

            if (!ldlChart.series[0]) {
              ldlChart.series[0] = new Series();
            }

            var existing = ldlChart.series[0].data.findIndex(x => x.category == effectiveDate);
            if (existing > -1) { // replacing measurement for day
              ldlChart.series[0].removePoint(existing);
            }
            ldlChart.series[0].addPoint([effectiveDate, parseFloat(value)]);
          },
          x => console.error(x));
    }
    function addHDL() {
      var value = document.getElementById("add-hdl").value;
      if (!value || isNaN(parseFloat(value))) {
        vm.displayModal('Invalid input', 'value must be filled out and numeric');
        return;
      }

      if (value <= LOW_HDL) {
        vm.displayModal("Low HDL Cholesterol", "Looks like your HDL (good) Cholesterol is a bit low. Check with your doctor and look at the provided resources for tips on managing your cholesterol.")
        
        if (!vm.high_values.some(val => val.type === "cholesterol"))
          vm.high_values.push({type: "cholesterol", title: "Cholesterol", low_val:LOW_HDL});
      }

      var effectiveDate = new Date(),
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
            vm.hdl_cholesterol = `${value} mg/dL`

            if (!hdlChart.series[0]) {
              hdlChart.series[0] = new Series();
            }

            // append to chart
            // may need to edit point instead of appending
            var effectiveDate = dateFromEffective(new Date());
            var existing = hdlChart.series[0].data.findIndex(x => x.category == effectiveDate);
            if (existing > -1) { // replacing measurement for day
              hdlChart.series[0].removePoint(existing);
            }
            hdlChart.series[0].addPoint([effectiveDate, parseFloat(value)]);
          },
          x => console.error(x));
    }
    function addBP() {

      var sys_value = document.getElementById("add-sys-bp").value,
        dia_value = document.getElementById("add-dia-bp").value;
      var effectiveDate = new Date();

      if (!(sys_value && dia_value)) {
        vm.displayModal("Invalid Input", "both systolic and diastolic values are required to add a blood pressure");
        return;
      }

      if (isNaN(parseFloat(sys_value)) || isNaN(parseFloat(dia_value))) {
        vm.displayModal('Invalid input', 'value must be filled out and numeric');
        return;
      }

      sys_value = parseFloat(sys_value);
      dia_value = parseFloat(dia_value);

      // check for high values
      if (dia_value >= HIGH_DIA_BP || sys_value >= HIGH_SYS_BP) {
        vm.displayModal("High Blood Pressure", "Looks like your blood pressure is a bit high. Check with your doctor and look at the provided resources for tips on managing and lowering your blood pressure.")
        
        if (!vm.high_values.some(val => val.type === "bp"))
          // doesn't really matter which, resources are the same for both
          vm.high_values.push({type: "bp", title: "Blood Pressure", hi_val:HIGH_SYS_BP});
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
            vm.sys_bp = `${sys_value} mmHg`
            vm.dia_bp = `${dia_value} mmHg`

            if (!bpChart.series[0]) {
              bpChart.series[0] = new Series();
            }
            if (!bpChart.series[1]) {
              bpChart.series[1] = new Series();
            }

            // append to chart
            // may need to edit point instead of appending
            var effectiveDate = dateFromEffective(new Date());
            var existing = bpChart.series[0].data.findIndex(x => x.category == effectiveDate);
            if (existing > -1) { // replacing measurement for day
              bpChart.series[0].removePoint(existing);
            }
            bpChart.series[0].addPoint([effectiveDate, parseFloat(sys_value)]);
            existing = bpChart.series[1].data.findIndex(x => x.category == effectiveDate);
            if (existing > -1) { // replacing measurement for day
              bpChart.series[1].removePoint(existing);
            }
            bpChart.series[1].addPoint([effectiveDate, parseFloat(dia_value)]);
          },
          x => console.error(x));
    }
    function addWeight() {
      var value = document.getElementById("add-weight").value;
      if (!value || isNaN(parseFloat(value))) {
        vm.displayModal('Invalid input', 'value must be filled out and numeric');
        return;
      }
      var effectiveDate = new Date(),
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
            vm.weight = `${value} kg`

            if (!weightChart.series[0]) {
              weightChart.series[0] = new Series();
            }

            // append to chart
            // may need to edit point instead of appending
            var effectiveDate = dateFromEffective(new Date());
            var existing = weightChart.series[0].data.findIndex(x => x.category == effectiveDate);
            if (existing > -1) { // replacing measurement for day
              weightChart.series[0].removePoint(existing);
            }
            weightChart.series[0].addPoint([effectiveDate, parseFloat(value)]);

            // also create bmi obv and update chart, if applicable
            addBMI();
            // this will be the same when adding a height
          },
          x => console.error(x));

    }

    // bind addition buttons
    document.getElementById('add-weight-button').addEventListener('click', addWeight);
    document.getElementById('add-height-button').addEventListener('click', addHeight);
    document.getElementById('add-hdl-button').addEventListener('click', addHDL);
    document.getElementById('add-ldl-button').addEventListener('click', addLDL);
    document.getElementById('add-bp-button').addEventListener('click', addBP);

  });

}

// vue app code

// register modal component
Vue.component("modal", {
  template: "#modal-template",
  computed: {
    modalHeader: function () {
      return vm.modalHeader;
    },
    modalBody: function () {
      return vm.modalBody;
    },
    modalFooter: function () {
      return vm.modalFooter;
    }
  },
});

// tab code modified from https://codepen.io/tatimblin/pen/oWKdjR?editors=1010
Vue.component('tabs', {
  template: `
      <div>
          <div class="tabs">
            <ul>
              <li v-for="tab in tabs" :class="{ 'is-active': tab.isActive }">
                  <a :href="tab.href" @click="selectTab(tab)">{{ tab.name }}</a>
              </li>
            </ul>
          </div>

          <div class="tabs-details">
              <slot></slot>
          </div>
      </div>
  `,
  
  data() {
      return {tabs: [] };
  },
  
  created() {
      
      this.tabs = this.$children;
      
  },
  methods: {
      selectTab(selectedTab) {
          this.tabs.forEach(tab => {
              tab.isActive = (tab.name == selectedTab.name);
          });
      }
  }
});

Vue.component('tab', {
  
  template: `

      <div v-show="isActive"><slot></slot></div>

  `,
  
  props: {
      name: { required: true },
      selected: { default: false}
  },
  
  data() {
      
      return {
          isActive: false
      };
      
  },
  
  computed: {
      
      href() {
          return '#' + this.name.toLowerCase().replace(/ /g, '-');
      }
  },
  
  mounted() {
      
      this.isActive = this.selected;
      
  }
});

var vm = new Vue({
  el: '#app',
  data: {
    // populate with variables we will need
    patient_name: "..",
    patient_dob_string: "..",
    patient_gender: "..",
    height: "undefined",
    weight: "undefined",
    bmi: "undefined",
    sys_bp: "undefined",
    dia_bp: "undefined",
    ldl_cholesterol: "undefined",
    hdl_cholesterol: "undefined",
    high_values: [],
    resources: [],
    showModal: false,
    modalHeader: "",
    modalBody: "",
    modalFooter: nbsp, // for button padding
    resourcesByType: {
      "bmi": [
        {name: "CDC: About BMI", href: "https://www.cdc.gov/healthyweight/assessing/bmi/adult_bmi/index.html"},
        {name: "CDC: Prevent Weight Gain", href: "https://www.cdc.gov/healthyweight/prevention/index.html"}
      ],
      "bp": [
        {name: "CDC: High Blood Pressure Symptoms and Causes", href: "https://www.cdc.gov/bloodpressure/about.htm"},
        {name: "CDC: Prevent High Blood Pressure", href: "https://www.cdc.gov/bloodpressure/prevent.htm"}
      ],
      "cholesterol": [
        {name: "WebMD: HDL Cholesterol: The Good Cholesterol", href: "https://www.webmd.com/cholesterol-management/guide/hdl-cholesterol-the-good-cholesterol"},
        {name: "WebMD: LDL Cholesterol: The Bad Cholesterol", href: "https://www.webmd.com/heart-disease/ldl-cholesterol-the-bad-cholesterol#1"}
      ]
    }
  },
  computed: {
    showResources: function(){
      return this.high_values.length > 0;
    }
  },
  methods: {
    displayModal: function (title, message) {
      this.showModal = true;
      this.modalHeader = title;
      this.modalBody = message;
    },

    hideModal: function () {
      this.showModal = false;
      this.modalHeader = "";
      this.modalBody = "";
      this.modalFooter = nbsp; // for button padding
    }
  },
  created: populatePatient,
})