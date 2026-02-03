
import React from 'react';
import { useParams } from 'react-router-dom';

// Type 1 Steps
import { Step1 as T1S1 } from './type1/step1/Step1';
import { Step2 as T1S2 } from './type1/step2/Step2';
import { Step3 as T1S3 } from './type1/step3/Step3';
import { Step4 as T1S4 } from './type1/step4/Step4';
import { Step5 as T1S5 } from './type1/step5/Step5';
import { Step6 as T1S6 } from './type1/step6/Step6';
import { Step7 as T1S7 } from './type1/step7/Step7';
import { Step8 as T1S8 } from './type1/step8/Step8';
import { Step9 as T1S9 } from './type1/step9/Step9';
import { Step10 as T1S10 } from './type1/step10/Step10';
import { Step11 as T1S11 } from './type1/step11/Step11';

// Type 2 Steps
import { Step1 as T2S1 } from './type2/step1/Step1';
import { Step2 as T2S2 } from './type2/step2/Step2';
import { Step3 as T2S3 } from './type2/step3/Step3';
import { Step4 as T2S4 } from './type2/step4/Step4';
import { Step5 as T2S5 } from './type2/step5/Step5';
import { Step6 as T2S6 } from './type2/step6/Step6';
import { Step7 as T2S7 } from './type2/step7/Step7';
import { Step8 as T2S8 } from './type2/step8/Step8';
import { Step9 as T2S9 } from './type2/step9/Step9';
import { Step10 as T2S10 } from './type2/step10/Step10';
import { Step11 as T2S11 } from './type2/step11/Step11';
import { Step12 as T2S12 } from './type2/step12/Step12';
import { Step13 as T2S13 } from './type2/step13/Step13';
import { Step14 as T2S14 } from './type2/step14/Step14';

// Type 3 Steps
import { Step1 as T3S1 } from './type3/step1/Step1';
import { Step2 as T3S2 } from './type3/step2/Step2';
import { Step3 as T3S3 } from './type3/step3/Step3';
import { Step4 as T3S4 } from './type3/step4/Step4';
import { Step5 as T3S5 } from './type3/step5/Step5';
import { Step6 as T3S6 } from './type3/step6/Step6';
import { Step7 as T3S7 } from './type3/step7/Step7';
import { Step8 as T3S8 } from './type3/step8/Step8';
import { Step9 as T3S9 } from './type3/step9/Step9';

// Type 4 Steps
import { Step1 as T4S1 } from './type4/step1/Step1';
import { Step2 as T4S2 } from './type4/step2/Step2';
import { Step3 as T4S3 } from './type4/step3/Step3';
import { Step4 as T4S4 } from './type4/step4/Step4';
import { Step5 as T4S5 } from './type4/step5/Step5';
import { Step6 as T4S6 } from './type4/step6/Step6';
import { Step7 as T4S7 } from './type4/step7/Step7';
import { Step8 as T4S8 } from './type4/step8/Step8';

interface StepDispatcherProps {
    step: number;
}

export const StepDispatcher: React.FC<StepDispatcherProps> = ({ step }) => {
    const { typeName } = useParams<{ typeName: string }>();

    // Determine Type ID
    // If typeName is "type2", typeId is 2.
    // If numeric, use it.
    let typeId = 1;
    if (typeName) {
        if (typeName.startsWith('type')) {
            const num = parseInt(typeName.replace('type', ''));
            if (!isNaN(num)) typeId = num;
        } else {
            // Fallback or specific slug handling? 
            // Assuming explicit type names for now as per app convention
            if (typeName === 'corporate-tax') typeId = 1; // Example
        }
    }

    switch (typeId) {
        case 1:
            switch (step) {
                case 1: return <T1S1 />;
                case 2: return <T1S2 />;
                case 3: return <T1S3 />;
                case 4: return <T1S4 />;
                case 5: return <T1S5 />;
                case 6: return <T1S6 />;
                case 7: return <T1S7 />;
                case 8: return <T1S8 />;
                case 9: return <T1S9 />;
                case 10: return <T1S10 />;
                case 11: return <T1S11 />;
                default: return <div>Step {step} not found for Type 1</div>;
            }
        case 2:
            switch (step) {
                case 1: return <T2S1 />;
                case 2: return <T2S2 />;
                case 3: return <T2S3 />;
                case 4: return <T2S4 />;
                case 5: return <T2S5 />;
                case 6: return <T2S6 />;
                case 7: return <T2S7 />;
                case 8: return <T2S8 />;
                case 9: return <T2S9 />;
                case 10: return <T2S10 />;
                case 11: return <T2S11 />;
                case 12: return <T2S12 />;
                case 13: return <T2S13 />;
                case 14: return <T2S14 />;
                default: return <div>Step {step} not found for Type 2</div>;
            }
        case 3:
            switch (step) {
                case 1: return <T3S1 />;
                case 2: return <T3S2 />;
                case 3: return <T3S3 />;
                case 4: return <T3S4 />;
                case 5: return <T3S5 />;
                case 6: return <T3S6 />;
                case 7: return <T3S7 />;
                case 8: return <T3S8 />;
                case 9: return <T3S9 />;
                default: return <div>Step {step} not found for Type 3</div>;
            }
        case 4:
            switch (step) {
                case 1: return <T4S1 />;
                case 2: return <T4S2 />;
                case 3: return <T4S3 />;
                case 4: return <T4S4 />;
                case 5: return <T4S5 />;
                case 6: return <T4S6 />;
                case 7: return <T4S7 />;
                case 8: return <T4S8 />;
                default: return <div>Step {step} not found for Type 4</div>;
            }
        default:
            return <div>Unknown Filing Type</div>;
    }
};
