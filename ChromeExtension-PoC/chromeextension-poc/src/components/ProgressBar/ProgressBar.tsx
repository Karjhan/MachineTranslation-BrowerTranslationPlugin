import React from 'react';
import { ProgressBar as BSProgressBar } from 'react-bootstrap';

type Props = {
  current: number;
  total: number;
};

export const ProgressBar: React.FC<Props> = ({ current, total }) => {
  const percent = total ? Math.floor((current / total) * 100) : 0;

  return (
    <div className="my-2">
      <BSProgressBar now={percent} label={`${percent}%`} />
    </div>
  );
};
