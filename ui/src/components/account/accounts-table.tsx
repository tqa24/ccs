/**
 * Accounts Table Component
 * Dashboard parity: Full CRUD for auth profiles
 */

import { useState } from 'react';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
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
import { Check, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { EditAccountContextDialog } from '@/components/account/edit-account-context-dialog';
import {
  useSetDefaultAccount,
  useDeleteAccount,
  useResetDefaultAccount,
} from '@/hooks/use-accounts';
import type { Account } from '@/lib/api-client';

interface AccountsTableProps {
  data: Account[];
  defaultAccount: string | null;
}

export function AccountsTable({ data, defaultAccount }: AccountsTableProps) {
  const setDefaultMutation = useSetDefaultAccount();
  const deleteMutation = useDeleteAccount();
  const resetDefaultMutation = useResetDefaultAccount();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [contextTarget, setContextTarget] = useState<Account | null>(null);

  const columns: ColumnDef<Account>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      size: 200,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.name}</span>
          {row.original.name === defaultAccount && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
              default
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      size: 100,
      cell: ({ row }) => (
        <span className="capitalize text-muted-foreground">{row.original.type || 'oauth'}</span>
      ),
    },
    {
      accessorKey: 'created',
      header: 'Created',
      size: 150,
      cell: ({ row }) => {
        const date = new Date(row.original.created);
        return <span className="text-muted-foreground">{date.toLocaleDateString()}</span>;
      },
    },
    {
      accessorKey: 'last_used',
      header: 'Last Used',
      size: 150,
      cell: ({ row }) => {
        if (!row.original.last_used) return <span className="text-muted-foreground/50">-</span>;
        const date = new Date(row.original.last_used);
        return <span className="text-muted-foreground">{date.toLocaleDateString()}</span>;
      },
    },
    {
      id: 'context',
      header: 'History Sync',
      size: 170,
      cell: ({ row }) => {
        if (row.original.type === 'cliproxy') {
          return <span className="text-muted-foreground/50">-</span>;
        }

        const mode = row.original.context_mode || 'isolated';
        if (mode === 'shared') {
          const group = row.original.context_group || 'default';
          if (row.original.continuity_mode === 'deeper') {
            return <span className="text-muted-foreground">shared ({group}, deeper)</span>;
          }

          if (row.original.continuity_inferred) {
            return (
              <span className="text-amber-700 dark:text-amber-400">
                shared ({group}, standard legacy)
              </span>
            );
          }

          return <span className="text-muted-foreground">shared ({group}, standard)</span>;
        }

        if (row.original.context_inferred) {
          return (
            <span className="text-amber-700 dark:text-amber-400">isolated (legacy default)</span>
          );
        }

        return <span className="text-muted-foreground">isolated</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 220,
      cell: ({ row }) => {
        const isDefault = row.original.name === defaultAccount;
        const isPending = setDefaultMutation.isPending || deleteMutation.isPending;
        const isCliproxy = row.original.type === 'cliproxy';

        return (
          <div className="flex items-center gap-1">
            {!isCliproxy && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                disabled={isPending}
                onClick={() => setContextTarget(row.original)}
                title="Edit context mode"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant={isDefault ? 'secondary' : 'default'}
              size="sm"
              className="h-8 px-2"
              disabled={isDefault || isPending}
              onClick={() => setDefaultMutation.mutate(row.original.name)}
            >
              <Check className={`w-3 h-3 mr-1 ${isDefault ? 'opacity-50' : ''}`} />
              {isDefault ? 'Active' : 'Set Default'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={isDefault || isPending}
              onClick={() => setDeleteTarget(row.original.name)}
              title={isDefault ? 'Cannot delete default account' : 'Delete account'}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No CCS auth accounts found. Use{' '}
        <code className="text-sm bg-muted px-1 rounded">ccs auth create</code> to add accounts.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const widthClass =
                      {
                        name: 'w-[200px]',
                        type: 'w-[100px]',
                        created: 'w-[150px]',
                        last_used: 'w-[150px]',
                        context: 'w-[170px]',
                        actions: 'w-[220px]',
                      }[header.id] || 'w-auto';

                    return (
                      <TableHead key={header.id} className={widthClass}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Reset default button */}
        {defaultAccount && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetDefaultMutation.mutate()}
              disabled={resetDefaultMutation.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to CCS Default
            </Button>
          </div>
        )}
      </div>

      {contextTarget && (
        <EditAccountContextDialog account={contextTarget} onClose={() => setContextTarget(null)} />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the account &quot;{deleteTarget}&quot;? This will
              remove the profile and all its session data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget);
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
