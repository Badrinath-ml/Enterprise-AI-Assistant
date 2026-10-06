import React from 'react';
import { Drawer } from '../common/Drawer';
import { Sidebar } from './Sidebar';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} position="left" width="max-w-[280px]">
      <div className="-m-5 h-full">
        <Sidebar onCloseMobile={onClose} />
      </div>
    </Drawer>
  );
};
