"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/lib/use-api";
import { fmtRelative } from "@/lib/format";
import type { AdminQuestion } from "@/types";

export default function QuestionsPage() {
  const { data, error } = useApi<{ questions: AdminQuestion[]; total: number }>(
    "/api/admin/questions?limit=100"
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Questions</h1>
        <p className="text-sm text-muted-foreground">
          All asked questions, newest first. Anonymous ones carry no email.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {data ? `${data.total} total · showing ${data.questions.length}` : "Loading…"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Input</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lang</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="max-w-md truncate font-mono text-xs">
                      {q.inputRedacted}
                    </TableCell>
                    <TableCell className="text-xs">
                      {q.isAnon ? (
                        <span className="text-muted-foreground">anonymous</span>
                      ) : (
                        q.email || "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{q.classifiedType}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{q.language}</TableCell>
                    <TableCell className="text-xs align-top">
                      {q.feedback ?? "—"}
                      {q.feedbackNote && (
                        <div className="mt-1 max-w-xs text-muted-foreground italic">
                          “{q.feedbackNote}”
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtRelative(q.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
