import Link from "next/link";

import { PropertyCard } from "@/components/properties/property-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPropertiesForClerkUserSafe } from "@/lib/db/queries";
import { ensureClerkUserSynced } from "@/lib/db/users";
import { currentUser } from "@clerk/nextjs/server";
import { Plus } from "lucide-react";

export default async function PropertiesPage() {
  const user = await currentUser();
  await ensureClerkUserSynced(user);
  const list = await getPropertiesForClerkUserSafe(user?.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
          <p className="mt-1 text-muted-foreground">
            All saved listings in one place.
          </p>
        </div>
        <Button className="gap-2 shadow-lg shadow-primary/10" asChild>
          <Link href="/properties/new">
            <Plus className="h-4 w-4" />
            Add property
          </Link>
        </Button>
      </div>

      {list.length === 0 ? (
        <Card className="border-dashed border-border bg-card/50">
          <CardHeader>
            <CardTitle className="text-base font-medium">
              No properties yet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Add a listing to see it here. Capture address, price, and status
              as you move through your search.
            </p>
            <Button asChild>
              <Link href="/properties/new">Add your first property</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((property) => (
            <li key={property.id}>
              <PropertyCard property={property} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
