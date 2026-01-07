import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Mail, RotateCcw, Trash2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PendingInvitation {
  id: string;
  email: string;
  full_name: string | null;
  role: 'client' | 'editor' | 'admin';
  created_at: string;
  agency_id: string;
}

interface PendingInvitationCardProps {
  invitation: PendingInvitation;
  agencyName: string;
  onResend: () => void;
  onCancel: () => void;
}

export function PendingInvitationCard({
  invitation,
  agencyName,
  onResend,
  onCancel,
}: PendingInvitationCardProps) {
  const [isResending, setIsResending] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const { toast } = useToast();

  const initials = invitation.full_name
    ? invitation.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : invitation.email[0].toUpperCase();

  const handleResend = async () => {
    setIsResending(true);
    try {
      const { error } = await supabase.functions.invoke('send-invite-email', {
        body: {
          invitationId: invitation.id,
          email: invitation.email,
          role: invitation.role,
          agencyName: agencyName,
        },
      });

      if (error) throw error;

      toast({
        title: 'Invite resent',
        description: `Invitation resent to ${invitation.email}`,
      });
      onResend();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend invitation',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('agency_invitations')
        .delete()
        .eq('id', invitation.id);

      if (error) throw error;

      toast({
        title: 'Invitation cancelled',
        description: `Invitation to ${invitation.email} has been cancelled`,
      });
      onCancel();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel invitation',
        variant: 'destructive',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const roleLabel = invitation.role === 'client' ? 'Client' : invitation.role === 'editor' ? 'Editor' : 'Admin';

  return (
    <Card className="glass-card border-border/30 hover:border-border/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12 border-2 border-dashed border-primary/30">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-foreground truncate">
                {invitation.full_name || 'Pending User'}
              </span>
              <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-600 dark:text-yellow-400">
                <Clock className="w-3 h-3 mr-1" />
                Pending
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
              <Mail className="w-3 h-3" />
              <span className="truncate">{invitation.email}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs">
                {roleLabel}
              </Badge>
              <span>•</span>
              <span>Sent {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              disabled={isResending || isCancelling}
              className="text-primary hover:text-primary"
            >
              {isResending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isResending || isCancelling}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {isCancelling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass-card border-border/50">
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel the invitation to {invitation.email}? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Invite</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Cancel Invite
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
