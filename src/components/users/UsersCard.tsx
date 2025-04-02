import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Avatar,
  Chip,
  Button,
  Divider,
  Grid
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Cake as CakeIcon,
  LocationOn as LocationOnIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { User } from './UserForm';

interface UsersCardProps {
  users: User[];
  onView: (user: User) => void;
  onEdit: (user: User) => void;
  onDelete: (userId: number | undefined) => void;
}

const UsersCard: React.FC<UsersCardProps> = ({ users, onView, onEdit, onDelete }) => {
  // Funzione per ottenere le iniziali dell'utente per l'avatar
  const getUserInitials = (user: User): string => {
    return `${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}`;
  };

  // Funzione per ottenere un colore casuale ma consistente per l'avatar basato sul nome
  const getAvatarColor = (user: User): string => {
    const colors = [
      '#e57373', '#f06292', '#ba68c8', '#9575cd', '#7986cb',
      '#64b5f6', '#4fc3f7', '#4dd0e1', '#4db6ac', '#81c784',
      '#aed581', '#dce775', '#fff176', '#ffd54f', '#ffb74d'
    ];
    
    // Usa le prime lettere del nome e cognome per generare un indice
    const nameSum = (user.first_name?.charCodeAt(0) || 65) + (user.last_name?.charCodeAt(0) || 65);
    return colors[nameSum % colors.length];
  };

  return (
    <Grid container spacing={2}>
      {users.map((user) => (
        <Grid item xs={12} sm={6} md={4} key={user.id}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar
                  sx={{
                    bgcolor: getAvatarColor(user),
                    width: 56,
                    height: 56,
                    mr: 2,
                    fontSize: '1.25rem'
                  }}
                >
                  {getUserInitials(user)}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    {user.first_name} {user.last_name}
                  </Typography>
                  {user.fiscal_code && (
                    <Chip 
                      label={user.fiscal_code} 
                      size="small" 
                      sx={{ mt: 0.5, fontSize: '0.75rem' }}
                    />
                  )}
                </Box>
              </Box>
              
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                <EmailIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="body2" sx={{ 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis' 
                }}>
                  {user.email || 'Email non disponibile'}
                </Typography>
              </Box>
              
              <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                <PhoneIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="body2">
                  {user.phone || 'Telefono non disponibile'}
                </Typography>
              </Box>
              
              {user.birth_date && (
                <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                  <CakeIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="body2">
                    {format(new Date(user.birth_date), 'dd MMMM yyyy', { locale: it })}
                  </Typography>
                </Box>
              )}
              
              {(user.city || user.address) && (
                <Box sx={{ mb: 1, display: 'flex', alignItems: 'flex-start' }}>
                  <LocationOnIcon fontSize="small" sx={{ mr: 1, mt: 0.5, color: 'primary.main' }} />
                  <Typography variant="body2" sx={{ 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {user.address && user.city ? `${user.address}, ${user.city}` : (user.address || user.city)}
                    {user.postal_code ? ` - ${user.postal_code}` : ''}
                  </Typography>
                </Box>
              )}
              
              {user.notes && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    <strong>Note:</strong> {user.notes}
                  </Typography>
                </Box>
              )}
            </CardContent>
            
            <CardActions sx={{ justifyContent: 'flex-end', p: 2, pt: 0 }}>
              <Button
                size="small"
                startIcon={<VisibilityIcon />}
                onClick={() => onView(user)}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Visualizza
              </Button>
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => onEdit(user)}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Modifica
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => onDelete(user.id)}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Elimina
              </Button>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default UsersCard;