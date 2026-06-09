import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "./queryClient";
import { useToast } from "@/hooks/use-toast";

// "Crew up with X": find-or-create a 1:1 squad with a matched connection and
// drop you into its campsite chat. Used from Matches + Profile.
export function useCrewUp() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (connection: { id: string; name: string }) => {
      // Smart find-or-create: reuses an existing 1:1 squad with this person.
      const res = await apiRequest("POST", "/api/groups/crew-up", { userId: connection.id });
      return res.json();
    },
    onSuccess: (group: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/my-led"] });
      toast({ title: group?.existing ? "Opening your squad 🏕️" : "Squad started! 🏕️", description: group?.existing ? undefined : "Add more of your crew from inside." });
      navigate(`/groups/${group.id}?tab=campsite`);
    },
    onError: (e: any) => toast({ title: e?.message?.replace(/^\d+:\s*/, "") || "Couldn't start the squad", variant: "destructive" }),
  });
}
