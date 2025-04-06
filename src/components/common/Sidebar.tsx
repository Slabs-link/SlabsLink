import React from 'react';
import { Box, List, ListItem, ListItemIcon, ListItemText, Divider, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
// Import the required icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import EventIcon from '@mui/icons-material/Event';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import DescriptionIcon from '@mui/icons-material/Description';
import EmailIcon from '@mui/icons-material/Email';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Utenti', icon: <PeopleIcon />, path: '/users' },
    { text: 'Appuntamenti', icon: <EventIcon />, path: '/appointments' },
    { text: 'Notifiche', icon: <NotificationsIcon />, path: '/notifications' },
    { text: 'Template Notifiche', icon: <EmailIcon />, path: '/appointment-templates' },
    { text: 'Impostazioni', icon: <SettingsIcon />, path: '/settings' },
  ];
  
  return (
    <Box sx={{ width: 240, flexShrink: 0, bgcolor: '#f8f9fa', height: '100vh', borderRight: '1px solid #e0e0e0' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>SlabsLink</Typography>
      </Box>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem 
            button 
            key={item.text}
            onClick={() => navigate(item.path)}
            sx={{ 
              mb: 1, 
              borderRadius: 1,
              bgcolor: location.pathname === item.path ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.08)' }
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
      {/* Logout button removed */}
    </Box>
  );
};

export default Sidebar;