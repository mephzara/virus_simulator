// constants
const POP_WIDTH                     =1000;
const POP_HEIGHT                    =1000;
const POPULATION                    =POP_WIDTH*POP_HEIGHT;
const CHART_UPDATE                  =5;

const IDV_STATE_UNINFECTED          =0;
const IDV_STATE_INFECTED            =10;
const IDV_STATE_INFECTED_SPREADING  =20;
const IDV_STATE_SICK                =30;
const IDV_STATE_HOSPITALIZED        =40;
const IDV_STATE_HOSPITALIZED_INTENSE=50;
const IDV_STATE_IMMUNE              =60;
const IDV_STATE_DEAD                =99;

//
class Population {
    InfectedCnt                 =0;
    InfectedCntTot              =0;
    CurrentlySickCnt            =0;
    HspCnt                      =0;
    HspCntTot                   =0;
    HspIntenseCnt               =0;
    HspIntenseCntTot            =0;
    ImmuneCnt                   =0;
    DeathCnt                    =0;     
    IsolatedCnt                 =0;
    PreventedInfectionsCnt      =0;

    MovementShortRange          =10;
    MovementLongRange           =200;
    MovementLongShortRatio      =0.7;

    IncubationTime              =5;
    IncubationTimeJitter        =0.3;
    InfectionRate               =2;

    TimeToGetSick               =5;
    TimeToGetSickJitter         =0.3;
    SicknessProbability         =0.1428;
    SickTime                    =14;
    SickTimeJitter              =0.3;

    TracingAppUsage             =0.2;  
    TracingTestProbability      =0.5;
    TracingAppStart             =0;

    HospitalizationTime         =14;
    HospitalizationTimeJitter   =0.5;
    HospitalizationProbability  =0.2;

    HspIntenseTime              =20;
    HspIntenseTimeJitter        =0.5;
    HspIntenseProbability       =0.05;

    CaseFatalityRate            =0.02;

    //
    constructor(aWidth,aHeight) {
        this.Steps       =0;
        this.PopArray   =[];
        this.Width      =aWidth;
        this.Height     =aHeight;        
    }

    //
    initPopulation() {
        this.IsolationTime  =this.IncubationTime+this.IncubationTime*this.IncubationTimeJitter+
                             this.TimeToGetSick+this.TimeToGetSick*this.TimeToGetSickJitter+
                             this.SickTime+this.SickTime*this.SickTimeJitter;

        for(var y=0;y<this.Height;y++) {
            var row=[];
    
            for(var x=0;x<this.Width;x++) {
                row.push(new Individual(this,x,y,IDV_STATE_UNINFECTED));
            }
    
            this.PopArray.push(row);
        }
    }
    
    //
    iterate(aImageData) {
        this.Steps++;

        for(var x=0;x<this.Width;x++) {
            for(var y=0;y<this.Height;y++) {
                this.PopArray[x][y].iterate();

                var c=this.PopArray[x][y].getStateColour();

                aImageData.data[4 * (y * aImageData.width + x)]     = c[0]; // red
                aImageData.data[4 * (y * aImageData.width + x) + 1] = c[1]; // green
                aImageData.data[4 * (y * aImageData.width + x) + 2] = c[2]; // blue
                aImageData.data[4 * (y * aImageData.width + x) + 3] = c[3]; // alpha
            }
        }
    }


}

//
class Individual {

    //
    constructor(aPopulation, aX, aY, aState) {
        this.Owner              =aPopulation;
        this.PosX               =aX;
        this.PosY               =aY;
        this.State              =aState; 
        this.InfectedFrom       =null;
        this.HasInfected        =[];
        this.DoInfection        =false; // flag that activates infection in the next iteration. This prevents that the infection will be processed in teh current iteration.
        this.IsIsolated         =false;  

        this.IncubationTime     =this.Owner.IncubationTime+this.Owner.IncubationTime*(Math.random()*2-1)*this.Owner.IncubationTimeJitter;
        this.TimeToGetSick      =this.Owner.TimeToGetSick+this.Owner.TimeToGetSick*(Math.random()*2-1)*this.Owner.TimeToGetSickJitter;
        this.SickTestOnStep     =Math.floor(Math.random()*this.TimeToGetSick);

        this.SickTime           =this.Owner.SickTime+this.Owner.SickTime*(Math.random()*2-1)*this.Owner.SickTimeJitter;
        this.HspTestOnStep      =Math.floor(Math.random()*this.SickTime);

        this.UseTracing         =Math.random()<=this.Owner.TracingAppUsage;        

        this.HspTime            =this.Owner.HospitalizationTime+this.Owner.HospitalizationTime*(Math.random()*2-1)*this.Owner.HospitalizationTimeJitter;
        this.HspIntTestOnStep   =Math.floor(Math.random()*this.HspTime);

        this.HspIntenseTime     =this.Owner.HspIntenseTime+this.Owner.HspIntenseTime*(Math.random()*2-1)*this.Owner.HspIntenseTimeJitter;
        this.CfrTestOnStep      =Math.floor(Math.random()*this.HspIntenseTime);

        this.InfectionStep      =this.TimeToGetSick/this.Owner.InfectionRate; // spread infections equaly during spreading time
        this.InfectionStepCnt   =0;
    }

    //
    infectInRange(aRange) {
        if(!this.IsIsolated) {
            var dX=Math.floor(Math.random()*aRange-aRange/2);
            var lY=Math.sqrt(aRange*aRange-dX*dX);

            var dY=Math.floor(Math.random() * lY-lY/2);

            var iX=this.PosX+dX;
            var iY=this.PosY+dY;

            if(iX<0)                    {iX=this.Owner.Width-iX;}
            if(iX>this.Owner.Width-1)   {iX=iX-this.Owner.Width;}

            if(iY<0)                    {iY=this.Owner.Height-iY;}
            if(iY>this.Owner.Height-1)  {iY=iY-this.Owner.Height;}
            
            var target=this.Owner.PopArray[iX][iY];

            if(target.State==IDV_STATE_UNINFECTED) {            
                target.InfectedFrom   =this;
                target.DoInfection    =true;
                this.HasInfected.push(target);
            }                    
        } else {
            this.Owner.PreventedInfectionsCnt++;
        }
    }

    //
    sendInfectionSignal(aLevel) {
        if(!this.IsIsolated && this.UseTracing) {
            switch(this.State) {
                case IDV_STATE_UNINFECTED:
                case IDV_STATE_INFECTED:
                case IDV_STATE_INFECTED_SPREADING:   
                    this.IsIsolated=true;
                    this.IsolatedSteps=0;    
                    this.Owner.IsolatedCnt++;
                    break;
            }
            
            if(aLevel<=2) {
                for (var actInd of this.HasInfected) {
                    actInd.sendInfectionSignal(aLevel+1);
                }
            }
        }
    }

    //
    iterate() {        
        switch(this.State) {
            case IDV_STATE_UNINFECTED:
                break; 

            case IDV_STATE_INFECTED:
                if(this.InfectedSteps>this.IncubationTime) {
                    this.State=IDV_STATE_INFECTED_SPREADING;
                }

                this.InfectedSteps++;
                break; 
        
            case IDV_STATE_INFECTED_SPREADING:
                {
                    var trcActive=this.UseTracing && (this.Owner.Steps>=this.Owner.TracingAppStart);

                    if(trcActive && (Math.random()<=this.Owner.TracingTestProbability)) {
                        this.sendInfectionSignal(0);
                    }

                    if(this.InfectionStepCnt<this.SpreadingSteps) {
                        if(Math.random()<=this.Owner.MovementLongShortRatio) {
                            this.infectInRange(this.Owner.MovementLongRange);
                        } else {                        
                            this.infectInRange(this.Owner.MovementShortRange);
                        }   
                        
                        this.InfectionStepCnt+=this.InfectionStep;
                    }
                    
                    if((this.SpreadingSteps==this.SickTestOnStep) && (Math.random()<=this.Owner.SicknessProbability)) {        
                        // getting sick
                        this.State      =IDV_STATE_SICK;
                        this.SickSteps  =0;

                        if(trcActive) {
                            this.sendInfectionSignal(0);
                        }

                    } else if(this.SpreadingSteps>this.TimeToGetSick) {
                        // getting healthy
                        this.State=IDV_STATE_IMMUNE;
                        this.Owner.ImmuneCnt++;
                        this.Owner.InfectedCnt--;
                    }

                    this.SpreadingSteps++;
                    this.InfectedSteps++;
                }
                break; 

            case IDV_STATE_SICK:                                
                if((this.SickSteps==this.HspTestOnStep) && (Math.random()<=this.Owner.HospitalizationProbability)) {   
                    // getting hospitalized
                    this.State=IDV_STATE_HOSPITALIZED;
                    this.HspSteps=0;
                    this.Owner.HspCnt++;
                    this.Owner.HspCntTot++;
                } else if(this.SickSteps>this.SickTime) {
                    // getting healthy
                    this.State=IDV_STATE_IMMUNE;
                    this.Owner.ImmuneCnt++;
                    this.Owner.InfectedCnt--;
                }

                this.SickSteps++;
                break; 

            case IDV_STATE_HOSPITALIZED:
                // getting hospitalized with intensive care            
                if((this.HspSteps==this.HspIntTestOnStep) && (Math.random()<=this.Owner.HspIntenseProbability)) { 
                    this.State=IDV_STATE_HOSPITALIZED_INTENSE;
                    this.HspIntSteps=0;
                    this.Owner.HspIntenseCnt++;
                    this.Owner.HspIntenseCntTot++;
                } else if(this.HspSteps>this.HspTime) { 
                    // getting healthy
                    this.State=IDV_STATE_IMMUNE;
                    this.Owner.ImmuneCnt++;
                    this.Owner.HspCnt--;
                    this.Owner.InfectedCnt--;
                }

                this.HspSteps++;
                break; 

            case IDV_STATE_HOSPITALIZED_INTENSE:                
                if((this.HspIntSteps==this.CfrTestOnStep) && (Math.random()<=this.Owner.CaseFatalityRate)) {
                    // dead
                    this.State=IDV_STATE_DEAD; 
                    this.Owner.DeathCnt++;                
                    this.Owner.HspCnt--;
                    this.Owner.HspIntenseCnt--;
                    this.Owner.InfectedCnt--;
                } else if(this.HspIntSteps>this.HspIntenseTime) {
                    // getting healthy
                    this.State=IDV_STATE_IMMUNE;
                    this.Owner.HspCnt--;
                    this.Owner.HspIntenseCnt--;
                    this.Owner.InfectedCnt--;
                }

                this.HspIntSteps++;
                break; 

            case IDV_STATE_IMMUNE:
                break; 

            case IDV_STATE_DEAD:
                break; 

            case IDV_STATE_UNINFECTED_ISOLATED:
                break;
        }

        if(this.DoInfection) {
            this.Owner.InfectedCnt++;
            this.Owner.InfectedCntTot++;

            this.InfectedSteps  =0;
            this.SpreadingSteps =0;                 
            this.State          =IDV_STATE_INFECTED;
            this.DoInfection    =false;
        }

        if(this.IsIsolated) {
            if(this.IsolatedSteps>=this.Owner.IsolationTime) {
                this.IsIsolated=false;
                this.IsolatedSteps=0;
                this.Owner.IsolatedCnt--;
            } else {
                this.IsolatedSteps++;
            }            
        }
    }

    //
    getStateColour() {
        var result=[255,255,255,255];

        switch(this.State) {
            case IDV_STATE_UNINFECTED:
                result=[200,200,200,255];
                break; 

            case IDV_STATE_INFECTED:
                result=[127,127,0,255];
                break; 
        
            case IDV_STATE_INFECTED_SPREADING:
                result=[255,0,0,255];
                break; 

            case IDV_STATE_SICK:
                result=[127,127,0,255];
                break; 

            case IDV_STATE_HOSPITALIZED:
                result=[255,0,255,255];
                break; 

            case IDV_STATE_HOSPITALIZED_INTENSE:
                result=[255,127,127,255];
                break; 

            case IDV_STATE_IMMUNE:
                result=[0,0,127,255];
                break; 

            case IDV_STATE_DEAD:
                result=[0,0,0,255];
                break; 
        }

        if(this.IsIsolated) {
            result=[0,0,255,255];
        }

        return result;
    }

}

$( document ).ready(function() {
    var intervalID=null;    
    var pop;
    var ctxMap;
    var popImg; 
    var chartInfections;
    var chartHsp;
    var chartIntenseHsp;

    setIntervalFnc=function() {
        intervalID=setInterval(function() {
            pop.iterate(popImg);            
            ctxMap.putImageData(popImg, 0, 0, 0, 0, pop.Width, pop.Height);

            // update charts
            if(pop.Steps%CHART_UPDATE==0) {
                chartInfections.data.labels.push(pop.Steps);
                chartInfections.data.datasets[0].data.push(pop.InfectedCnt);
                chartInfections.data.datasets[1].data.push(pop.InfectedCntTot);
                chartInfections.data.datasets[2].data.push(pop.ImmuneCnt);
                chartInfections.data.datasets[3].data.push(pop.IsolatedCnt);
                chartInfections.data.datasets[4].data.push(pop.PreventedInfectionsCnt);
                chartInfections.update();
                
                chartHsp.data.labels.push(pop.Steps);
                chartHsp.data.datasets[0].data.push(pop.HspCnt);
                chartHsp.data.datasets[1].data.push(pop.HspCntTot);
                chartHsp.update();

                chartIntenseHsp.data.labels.push(pop.Steps);
                chartIntenseHsp.data.datasets[0].data.push(pop.HspIntenseCnt);
                chartIntenseHsp.data.datasets[1].data.push(pop.HspIntenseCntTot);
                chartIntenseHsp.data.datasets[2].data.push(pop.DeathCnt);
                chartIntenseHsp.update();
            }            
        },100);
    }

    // start button
    $('#cmdStart').click(function() {
        if(intervalID) {
            clearInterval(intervalID);
        }

        // image data
        ctxMap=document.getElementById("world").getContext('2d');
        ctxMap.fillRect(0, 0, POP_WIDTH, POP_HEIGHT);
        popImg = ctxMap.createImageData(POP_WIDTH, POP_HEIGHT);

        // init population
        pop=new Population(POP_WIDTH,POP_HEIGHT);    

        pop.MovementShortRange          =Number($('#moveShortRange').val());
        pop.MovementLongRange           =Number($('#movLongRange').val());
        pop.MovementLongShortRatio      =Number($('#movShortLongRatio').val());

        pop.IncubationTime              =Number($('#incubationTime').val());
        pop.IncubationTimeJitter        =Number($('#incubationTimeJitter').val());
        pop.InfectionRate               =Number($('#infectionRate').val());

        pop.TimeToGetSick               =Number($('#timeToGetSick').val());
        pop.TimeToGetSickJitter         =Number($('#timeToGetSickJitter').val());
        pop.SicknessProbability         =Number($('#sicknessProbability').val());

        pop.SickTime                    =Number($('#sickTime').val());
        pop.SickTimeJitter              =Number($('#sickTimeJitter').val()); 

        pop.TracingAppUsage             =Number($('#tracingAppUsage').val());
        pop.TracingTestProbability      =Number($('#tracingTestProbability').val());        
        pop.TracingAppStart             =Number($('#tracingAppStart').val());

        pop.HospitalizationTime         =Number($('#hospitalizationTime').val());
        pop.HospitalizationTimeJitter   =Number($('#hospitalizationTimeJitter').val());
        pop.HospitalizationProbability  =Number($('#hospitalizationProbability').val());

        pop.HspIntenseTime              =Number($('#hospIntenseTime').val());
        pop.HspIntenseTimeJitter        =Number($('#hospIntenseTimeJitter').val());
        pop.HspIntenseProbability       =Number($('#hospIntenseProbability').val());

        pop.CaseFatalityRate            =Number($('#caseFatalityRate').val());

        pop.initPopulation();

        // charts
        var ctxInfections = document.getElementById('chartInfections').getContext('2d');       

        chartInfections = new Chart(ctxInfections, {    
            type: 'line',          
            data: {            
                datasets: [{    
                    label: 'Current Infections',
                    backgroundColor: 'rgba(255, 0, 0, 0.25)',
                    borderColor: 'rgb(255, 0, 0)',
                    lineTension: 0,
                    yAxisID: '1',
                    data: []
                },{    
                    label: 'Infections Total',
                    backgroundColor: 'rgba(128, 0, 0, 0.25)',
                    borderColor: 'rgb(128, 0, 0)',
                    lineTension: 0,
                    yAxisID: '1',
                    data: []
                },{    
                    label: 'Immunizations',
                    backgroundColor: 'rgba(0, 0, 128, 0.25)',
                    borderColor: 'rgb(0, 0, 255)',
                    lineTension: 0,
                    yAxisID: '1',
                    data: []
                },{    
                    label: 'Isolated',
                    backgroundColor: 'rgba(0, 255, 255, 0.25)',
                    borderColor: 'rgb(0, 255, 255)',
                    lineTension: 0,
                    yAxisID: '1',
                    data: []
                },{    
                    label: 'Prevented Infections',
                    backgroundColor: 'rgba(128, 0, 128, 0.25)',
                    borderColor: 'rgb(128, 0, 128)',
                    lineTension: 0,
                    yAxisID: '1',
                    data: []
                }]
            },

            options: {                
                scales: {
                    yAxes: [{
                      id: '1',
                      type: 'linear',
                      position: 'left'
                    }]                    
                }
            }  
        }); 

        var ctxHsp = document.getElementById('chartHsp').getContext('2d');       
        
        chartHsp = new Chart(ctxHsp, {    
            type: 'line',          
            data: {            
                datasets: [{    
                    label: 'Current Hospitalizations',
                    backgroundColor: 'rgba(255, 0, 0, 0.25)',
                    borderColor: 'rgb(255, 0, 0)',
                    lineTension: 0,
                    yAxisID: '1',
                    data: []
                },{    
                    label: 'Total Hospitalizations',
                    backgroundColor: 'rgba(128, 0, 0, 0.25)',
                    borderColor: 'rgb(128, 0, 0)',
                    lineTension: 0,
                    yAxisID: '1',
                    data: []
                }]
            },

            options: {                
                scales: {
                    yAxes: [{
                      id: '1',
                      type: 'linear',
                      position: 'left'
                    }]                    
                }
            }  
        }); 

        var ctxIntenseHsp = document.getElementById('chartIntenseHsp').getContext('2d');       
        
        chartIntenseHsp = new Chart(ctxIntenseHsp, {    
            type: 'line',          
            data: {            
                datasets: [{    
                    label: 'Current Intensive Care',
                    backgroundColor: 'rgba(255, 0, 0, 0.25)',
                    borderColor: 'rgb(255, 0, 0)',
                    lineTension: 0,
                    yAxisID: '1',
                    data: []
                },{    
                    label: 'Total Intensive Care',
                    backgroundColor: 'rgba(128, 0, 0, 0.25)',
                    borderColor: 'rgb(128, 0, 0)',
                    lineTension: 0,
                    yAxisID: '1',
                    data: []
                },{    
                    label: 'Deaths',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    borderColor: 'rgb(0, 0, 0)',
                    lineTension: 0,
                    yAxisID: '1',
                    data: []
                }]
            },

            options: {                
                scales: {
                    yAxes: [{
                      id: '1',
                      type: 'linear',
                      position: 'left'
                    }]                    
                }
            }  
        }); 

        // simulation 
        pop.PopArray[Math.floor(pop.Width / 2)][Math.floor(pop.Height / 2)].DoInfection=true;

        setIntervalFnc();
    });    

    $('#cmdStop').click(function() {
        if(intervalID) {
            clearInterval(intervalID);
        }
    });

    $('#cmdContinue').click(function() {
        setIntFnc();
    });

});

