import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RemoveMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl?: string | null;
  } | null;
  memberType: 'client' | 'editor';
  onSuccess?: () => void;
}

export function RemoveMemberModal({
  open,
  onOpenChange,
  member,
  memberType,
  onSuccess,
}: RemoveMemberModalProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const { toast } = useToast();

  if (!member) return null;

  const initials = member.name
    ? member.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : member.email.slice(0, 2).toUpperCase();

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      // First, delete from user_roles (removes their access to the agency)
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', member.id);

      if (roleError) {
        console.error('Error deleting user role:', roleError);
        throw new Error('Failed to remove user access');
      }

      // Then, delete from profiles (removes their profile data)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', member.id);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
        throw new Error('Failed to remove user profile');
      }

      toast({
        title: `${memberType === 'client' ? 'Client' : 'Team member'} removed`,
        description: `${member.name || member.email} has been removed from your agency.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Failed to remove',
        description: error.message || 'An error occurred while removing the user.',
        variant: 'destructive',
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="glass-card">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <AlertDialogTitle>
              Remove {memberType === 'client' ? 'Client' : 'Team Member'}?
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-elevated/50 mb-4">
              <Avatar className="w-10 h-10 border border-border/50">
                <AvatarImage src={member.avatarUrl || undefined} alt={member.name || member.email} />
                <AvatarFallback className="bg-primary/20 text-primary text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{member.name || 'Unnamed'}</p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
            </div>
            <p>
              This will permanently remove <strong>{member.name || member.email}</strong> from your agency.
              They will lose access to all projects and data.
            </p>
            <p className="mt-2 text-destructive font-medium">
              This action cannot be undone.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleRemove();
            }}
            disabled={isRemoving}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {isRemoving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Removing...
              </>
            ) : (
              'Remove'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
