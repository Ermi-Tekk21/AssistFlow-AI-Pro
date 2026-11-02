import React from "react";
import { useStore } from "../store/useStore";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import { formatDateTime } from "../lib/utils";

export const PendingActionCard: React.FC = () => {
  const { pendingActions, confirmAction, rejectAction } = useStore();

  if (pendingActions.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center space-x-2 text-xs font-semibold text-amber-800 uppercase tracking-wider">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <span>Pending Approval Required Before Mutation</span>
      </div>

      {pendingActions.map((action) => (
        <Card
          key={action.id}
          className="border-amber-300 bg-amber-50/40 shadow-sm transition-all"
        >
          <CardHeader className="pb-3 border-amber-200/50 flex flex-row items-center justify-between">
            <div className="flex items-center space-x-2">
              <Badge variant="warning">{action.actionType.replace(/_/g, " ").toUpperCase()}</Badge>
              <CardTitle className="text-sm font-semibold text-slate-900">
                Proposed State Mutation
              </CardTitle>
            </div>
            <div className="flex items-center text-xs text-slate-500 font-mono">
              <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Expires: {formatDateTime(action.expiresAt)}
            </div>
          </CardHeader>

          <CardContent className="pt-3 pb-2 text-sm text-slate-800 font-medium">
            <p className="bg-white p-3 rounded border border-amber-200/70 text-slate-900 font-mono text-xs">
              "{action.proposal}"
            </p>

            {action.payload && Object.keys(action.payload).length > 0 && (
              <details className="mt-2 text-xs text-slate-500 cursor-pointer">
                <summary className="hover:text-slate-700">View payload parameters</summary>
                <pre className="mt-1 p-2 bg-slate-100 rounded text-[11px] overflow-x-auto text-slate-800">
                  {JSON.stringify(action.payload, null, 2)}
                </pre>
              </details>
            )}
          </CardContent>

          <CardFooter className="pt-3 pb-3 border-amber-200/50 justify-end space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => rejectAction(action.id)}
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <XCircle className="w-4 h-4 mr-1.5 text-slate-500" />
              Cancel (No)
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={() => confirmAction(action.id)}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Confirm & Execute (Yes)
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};
