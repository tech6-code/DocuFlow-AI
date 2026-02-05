import React from 'react';

type StepRenderProps = {
    render: () => JSX.Element;
};

export const StepRenderer: React.FC<StepRenderProps> = ({ render }) => render();
