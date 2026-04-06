import {aws-iot-sitewise} from "aws-cdk-lib";
import React, {createContext, useContext, useState} from "react";

interface PredictiveAnalysisContextValue {
    anomalyScore: number;
    setAnomalyScore: (score: number) => void;
}

const PredictiveAnalysisContext = createContext<PredictiveAnalysisContextValue>({
    anomalyScore: 0,
    setAnomalyScore: () => {},
});

export const PredictiveAnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [anomalyScore, setAnomalyScore] = useState(0);
    